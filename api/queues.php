<?php
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/csrf.php';

requireJsonRequest();
requireSameOrigin();

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';
$db     = getDB();

// Auto-expire stale switch requests where either party is no longer waiting,
// or the queue date has rolled over.
function expireStaleSwitchRequests(PDO $db): void {
    $db->exec('
        UPDATE queue_switch_requests qsr
        JOIN queues q1 ON qsr.from_queue_id = q1.queue_id
        JOIN queues q2 ON qsr.to_queue_id   = q2.queue_id
           SET qsr.status = "expired"
         WHERE qsr.status = "pending"
           AND (q1.queue_status <> "waiting"
                OR q2.queue_status <> "waiting"
                OR q1.queue_date < CURDATE()
                OR q2.queue_date < CURDATE())
    ');
}

// ─── GET: inbox of switch requests for current user ─────────────────
if ($method === 'GET' && $action === 'my_switch_requests') {
    $user = requireLogin();
    expireStaleSwitchRequests($db);

    $incoming = $db->prepare('
        SELECT qsr.request_id, qsr.from_queue_id, qsr.to_queue_id,
               qsr.status, qsr.created_at,
               q1.queue_number AS from_queue_number,
               q2.queue_number AS to_queue_number,
               uf.username     AS from_username,
               s.service_name, s.service_id
          FROM queue_switch_requests qsr
          JOIN queues   q1 ON qsr.from_queue_id = q1.queue_id
          JOIN queues   q2 ON qsr.to_queue_id   = q2.queue_id
          JOIN users    uf ON qsr.from_user_id  = uf.user_id
          JOIN services s  ON q1.service_id     = s.service_id
         WHERE qsr.to_user_id = ? AND qsr.status = "pending"
         ORDER BY qsr.created_at DESC
    ');
    $incoming->execute([$user['user_id']]);

    $outgoing = $db->prepare('
        SELECT qsr.request_id, qsr.from_queue_id, qsr.to_queue_id,
               qsr.status, qsr.created_at, qsr.responded_at,
               q1.queue_number AS from_queue_number,
               q2.queue_number AS to_queue_number,
               ut.username     AS to_username,
               s.service_name, s.service_id
          FROM queue_switch_requests qsr
          JOIN queues   q1 ON qsr.from_queue_id = q1.queue_id
          JOIN queues   q2 ON qsr.to_queue_id   = q2.queue_id
          JOIN users    ut ON qsr.to_user_id    = ut.user_id
          JOIN services s  ON q1.service_id     = s.service_id
         WHERE qsr.from_user_id = ?
           AND qsr.status IN ("pending","accepted","rejected","cancelled","expired")
           AND qsr.created_at >= NOW() - INTERVAL 1 DAY
         ORDER BY qsr.created_at DESC
    ');
    $outgoing->execute([$user['user_id']]);

    jsonResponse([
        'incoming' => $incoming->fetchAll(),
        'outgoing' => $outgoing->fetchAll(),
    ]);
}

// ─── GET: list queues ───────────────────────────────────────────────
if ($method === 'GET') {
    $serviceId = $_GET['service_id'] ?? null;
    $date      = $_GET['date']       ?? date('Y-m-d');
    $status    = $_GET['status']     ?? null;

    $sql = '
        SELECT q.queue_id, q.service_id, q.user_id, q.queue_number,
               q.queue_date, q.queue_status, q.created_at,
               u.username, s.service_name
        FROM queues q
        JOIN users u    ON q.user_id    = u.user_id
        JOIN services s ON q.service_id = s.service_id
        WHERE q.queue_date = ?
    ';
    $params = [$date];

    if ($serviceId) {
        $sql .= ' AND q.service_id = ?';
        $params[] = (int)$serviceId;
    }
    if ($status) {
        $sql .= ' AND q.queue_status = ?';
        $params[] = $status;
    }
    $sql .= ' ORDER BY q.queue_number ASC';

    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    jsonResponse(['queues' => $stmt->fetchAll()]);
}

// ─── POST: actions ──────────────────────────────────────────────────
if ($method === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);

    // JOIN queue (customer)
    if ($action === 'join') {
        $user = requireLogin();
        $serviceId = (int)($data['service_id'] ?? 0);
        if (!$serviceId) jsonResponse(['error' => 'service_id required'], 400);

        $db->beginTransaction();
        try {
            // Lock the (service_id, queue_date) range. Under REPEATABLE READ this
            // acquires gap locks that block any concurrent INSERT into the same
            // range until we commit, so the MAX+INSERT below is race-free.
            $lock = $db->prepare('
                SELECT COALESCE(MAX(queue_number), 0) + 1 AS next_num
                FROM queues WHERE service_id = ? AND queue_date = CURDATE()
                FOR UPDATE
            ');
            $lock->execute([$serviceId]);
            $nextNum = (int)$lock->fetch()['next_num'];

            // Duplicate check inside the transaction
            $dup = $db->prepare('
                SELECT queue_id FROM queues
                WHERE service_id = ? AND user_id = ? AND queue_date = CURDATE()
                  AND queue_status IN ("waiting","serving")
            ');
            $dup->execute([$serviceId, $user['user_id']]);
            if ($dup->fetch()) {
                $db->rollBack();
                jsonResponse(['error' => 'Already in this queue today'], 409);
            }

            $ins = $db->prepare('
                INSERT INTO queues (service_id, user_id, queue_number, queue_date, queue_status)
                VALUES (?, ?, ?, CURDATE(), "waiting")
            ');
            $ins->execute([$serviceId, $user['user_id'], $nextNum]);
            $queueId = (int)$db->lastInsertId();

            $db->commit();
            jsonResponse([
                'message'      => 'Joined queue',
                'queue_id'     => $queueId,
                'queue_number' => $nextNum,
            ], 201);
        } catch (Throwable $e) {
            if ($db->inTransaction()) $db->rollBack();
            throw $e;
        }
    }

    // SERVE NEXT (staff/admin)
    if ($action === 'next') {
        requireRole('staff', 'admin');
        $serviceId = (int)($data['service_id'] ?? 0);
        if (!$serviceId) jsonResponse(['error' => 'service_id required'], 400);

        $db->beginTransaction();
        try {
            // Lock the next waiting row before promoting. If two staff click Next
            // simultaneously, the second one blocks here until the first commits,
            // then the SELECT returns either the next-next row or no row.
            $next = $db->prepare('
                SELECT queue_id FROM queues
                WHERE service_id = ? AND queue_date = CURDATE() AND queue_status = "waiting"
                ORDER BY queue_number ASC LIMIT 1
                FOR UPDATE
            ');
            $next->execute([$serviceId]);
            $row = $next->fetch();

            // Mark current "serving" as "served" inside the same transaction
            $db->prepare('
                UPDATE queues SET queue_status = "served"
                WHERE service_id = ? AND queue_date = CURDATE() AND queue_status = "serving"
            ')->execute([$serviceId]);

            if (!$row) {
                $db->commit();
                jsonResponse(['message' => 'No more in queue']);
            }

            $db->prepare('UPDATE queues SET queue_status = "serving" WHERE queue_id = ?')
               ->execute([$row['queue_id']]);

            $db->commit();
            jsonResponse(['message' => 'Now serving', 'queue_id' => (int)$row['queue_id']]);
        } catch (Throwable $e) {
            if ($db->inTransaction()) $db->rollBack();
            throw $e;
        }
    }

    // SKIP a person (staff/admin) — marks as skipped
    if ($action === 'skip') {
        requireRole('staff', 'admin');
        $queueId = (int)($data['queue_id'] ?? 0);
        if (!$queueId) jsonResponse(['error' => 'queue_id required'], 400);

        $db->prepare('UPDATE queues SET queue_status = "skipped" WHERE queue_id = ?')
           ->execute([$queueId]);
        jsonResponse(['message' => 'Skipped']);
    }

    // RE-ADD a skipped person to front of waiting list (staff/admin)
    if ($action === 'readd') {
        requireRole('staff', 'admin');
        $queueId = (int)($data['queue_id'] ?? 0);
        if (!$queueId) jsonResponse(['error' => 'queue_id required'], 400);

        // Get info about the skipped entry
        $entry = $db->prepare('SELECT * FROM queues WHERE queue_id = ? AND queue_status = "skipped"');
        $entry->execute([$queueId]);
        $row = $entry->fetch();
        if (!$row) jsonResponse(['error' => 'Entry not found or not skipped'], 404);

        // Find current lowest waiting queue_number and assign one below it
        $minWait = $db->prepare('
            SELECT COALESCE(MIN(queue_number), 9999) AS mn
            FROM queues
            WHERE service_id = ? AND queue_date = CURDATE() AND queue_status = "waiting"
        ');
        $minWait->execute([$row['service_id']]);
        $frontNum = max(1, (int)$minWait->fetch()['mn'] - 1);

        // If there's a conflict, shift others up by 1
        $db->prepare('
            UPDATE queues SET queue_number = queue_number + 1
            WHERE service_id = ? AND queue_date = CURDATE()
              AND queue_number >= ? AND queue_status = "waiting"
        ')->execute([$row['service_id'], $frontNum]);

        $db->prepare('UPDATE queues SET queue_status = "waiting", queue_number = ? WHERE queue_id = ?')
           ->execute([$frontNum, $queueId]);

        jsonResponse(['message' => 'Re-added to front of queue']);
    }

    // SWITCH positions directly — staff/admin only (administrative override)
    if ($action === 'switch') {
        requireRole('staff', 'admin');
        $qidA = (int)($data['queue_id_a'] ?? 0);
        $qidB = (int)($data['queue_id_b'] ?? 0);
        if (!$qidA || !$qidB || $qidA === $qidB) {
            jsonResponse(['error' => 'two distinct queue_ids required'], 400);
        }

        $stmt = $db->prepare('
            SELECT queue_id, queue_number, service_id, queue_date
              FROM queues
             WHERE queue_id IN (?, ?) AND queue_status = "waiting"
        ');
        $stmt->execute([$qidA, $qidB]);
        $rows = $stmt->fetchAll();
        if (count($rows) !== 2) jsonResponse(['error' => 'Both entries must be waiting'], 400);
        if ($rows[0]['service_id'] !== $rows[1]['service_id']
            || $rows[0]['queue_date'] !== $rows[1]['queue_date']) {
            jsonResponse(['error' => 'Entries must be in the same service and date'], 400);
        }

        $a = $rows[0]['queue_id'] == $qidA ? $rows[0] : $rows[1];
        $b = $rows[0]['queue_id'] == $qidB ? $rows[0] : $rows[1];

        $db->beginTransaction();
        $db->prepare('UPDATE queues SET queue_number = ? WHERE queue_id = ?')->execute([$b['queue_number'], $a['queue_id']]);
        $db->prepare('UPDATE queues SET queue_number = ? WHERE queue_id = ?')->execute([$a['queue_number'], $b['queue_id']]);
        $db->commit();

        jsonResponse(['message' => 'Positions switched']);
    }

    // REQUEST a consent-based switch (any logged-in user, one side must be theirs)
    if ($action === 'switch_request') {
        $user = requireLogin();
        $fromQid = (int)($data['from_queue_id'] ?? 0);
        $toQid   = (int)($data['to_queue_id']   ?? 0);
        if (!$fromQid || !$toQid || $fromQid === $toQid) {
            jsonResponse(['error' => 'from_queue_id and to_queue_id required (must differ)'], 400);
        }

        $stmt = $db->prepare('
            SELECT queue_id, queue_number, service_id, queue_date, user_id, queue_status
              FROM queues WHERE queue_id IN (?, ?)
        ');
        $stmt->execute([$fromQid, $toQid]);
        $rows = $stmt->fetchAll();
        if (count($rows) !== 2) jsonResponse(['error' => 'Queue entries not found'], 404);

        $from = $rows[0]['queue_id'] == $fromQid ? $rows[0] : $rows[1];
        $to   = $rows[0]['queue_id'] == $toQid   ? $rows[0] : $rows[1];

        if ($from['user_id'] != $user['user_id']) {
            jsonResponse(['error' => 'You can only initiate a switch from your own entry'], 403);
        }
        if ($from['queue_status'] !== 'waiting' || $to['queue_status'] !== 'waiting') {
            jsonResponse(['error' => 'Both entries must be waiting'], 400);
        }
        if ($from['service_id'] !== $to['service_id'] || $from['queue_date'] !== $to['queue_date']) {
            jsonResponse(['error' => 'Entries must be in the same service and date'], 400);
        }
        if ($from['user_id'] == $to['user_id']) {
            jsonResponse(['error' => 'Cannot switch with yourself'], 400);
        }

        // Reject if a pending request already exists between these two entries (either direction)
        $dup = $db->prepare('
            SELECT request_id FROM queue_switch_requests
             WHERE status = "pending"
               AND ((from_queue_id = ? AND to_queue_id = ?)
                 OR (from_queue_id = ? AND to_queue_id = ?))
        ');
        $dup->execute([$fromQid, $toQid, $toQid, $fromQid]);
        if ($dup->fetch()) {
            jsonResponse(['error' => 'A pending switch request already exists between these entries'], 409);
        }

        $ins = $db->prepare('
            INSERT INTO queue_switch_requests (from_queue_id, to_queue_id, from_user_id, to_user_id)
            VALUES (?, ?, ?, ?)
        ');
        $ins->execute([$fromQid, $toQid, $from['user_id'], $to['user_id']]);
        jsonResponse([
            'message'    => 'Switch request sent',
            'request_id' => (int)$db->lastInsertId(),
        ], 201);
    }

    // RESPOND to a switch request (recipient only): accept or reject
    if ($action === 'switch_respond') {
        $user = requireLogin();
        $requestId = (int)($data['request_id'] ?? 0);
        $decision  = $data['decision'] ?? '';
        if (!$requestId || !in_array($decision, ['accept', 'reject'], true)) {
            jsonResponse(['error' => 'request_id and decision (accept|reject) required'], 400);
        }

        $db->beginTransaction();
        try {
            $stmt = $db->prepare('
                SELECT qsr.*, q1.queue_number AS from_num, q1.queue_status AS from_status,
                       q1.service_id AS from_svc, q1.queue_date AS from_date,
                       q2.queue_number AS to_num,   q2.queue_status AS to_status,
                       q2.service_id AS to_svc,   q2.queue_date AS to_date
                  FROM queue_switch_requests qsr
                  JOIN queues q1 ON qsr.from_queue_id = q1.queue_id
                  JOIN queues q2 ON qsr.to_queue_id   = q2.queue_id
                 WHERE qsr.request_id = ?
                 FOR UPDATE
            ');
            $stmt->execute([$requestId]);
            $req = $stmt->fetch();
            if (!$req) { $db->rollBack(); jsonResponse(['error' => 'Request not found'], 404); }
            if ($req['to_user_id'] != $user['user_id']) {
                $db->rollBack();
                jsonResponse(['error' => 'You are not the recipient of this request'], 403);
            }
            if ($req['status'] !== 'pending') {
                $db->rollBack();
                jsonResponse(['error' => 'Request is no longer pending'], 409);
            }

            if ($decision === 'reject') {
                $db->prepare('UPDATE queue_switch_requests SET status = "rejected", responded_at = NOW() WHERE request_id = ?')
                   ->execute([$requestId]);
                $db->commit();
                jsonResponse(['message' => 'Request rejected']);
            }

            // accept — re-validate both entries are still waiting and same service/date
            if ($req['from_status'] !== 'waiting' || $req['to_status'] !== 'waiting'
                || $req['from_svc']  !== $req['to_svc']
                || $req['from_date'] !== $req['to_date']) {
                $db->prepare('UPDATE queue_switch_requests SET status = "expired", responded_at = NOW() WHERE request_id = ?')
                   ->execute([$requestId]);
                $db->commit();
                jsonResponse(['error' => 'Switch is no longer valid; request expired'], 409);
            }

            $db->prepare('UPDATE queues SET queue_number = ? WHERE queue_id = ?')
               ->execute([$req['to_num'], $req['from_queue_id']]);
            $db->prepare('UPDATE queues SET queue_number = ? WHERE queue_id = ?')
               ->execute([$req['from_num'], $req['to_queue_id']]);
            $db->prepare('UPDATE queue_switch_requests SET status = "accepted", responded_at = NOW() WHERE request_id = ?')
               ->execute([$requestId]);

            // Cancel any other pending requests that reference either queue_id
            $db->prepare('
                UPDATE queue_switch_requests
                   SET status = "cancelled", responded_at = NOW()
                 WHERE status = "pending"
                   AND request_id <> ?
                   AND (from_queue_id IN (?, ?) OR to_queue_id IN (?, ?))
            ')->execute([$requestId, $req['from_queue_id'], $req['to_queue_id'], $req['from_queue_id'], $req['to_queue_id']]);

            $db->commit();
            jsonResponse(['message' => 'Switch accepted; positions swapped']);
        } catch (Throwable $e) {
            if ($db->inTransaction()) $db->rollBack();
            throw $e;
        }
    }

    // CANCEL an outgoing switch request (requester only, while still pending)
    if ($action === 'switch_cancel') {
        $user = requireLogin();
        $requestId = (int)($data['request_id'] ?? 0);
        if (!$requestId) jsonResponse(['error' => 'request_id required'], 400);

        $stmt = $db->prepare('SELECT from_user_id, status FROM queue_switch_requests WHERE request_id = ?');
        $stmt->execute([$requestId]);
        $req = $stmt->fetch();
        if (!$req) jsonResponse(['error' => 'Request not found'], 404);
        if ($req['from_user_id'] != $user['user_id']) {
            jsonResponse(['error' => 'You did not create this request'], 403);
        }
        if ($req['status'] !== 'pending') {
            jsonResponse(['error' => 'Request is no longer pending'], 409);
        }

        $db->prepare('UPDATE queue_switch_requests SET status = "cancelled", responded_at = NOW() WHERE request_id = ?')
           ->execute([$requestId]);
        jsonResponse(['message' => 'Request cancelled']);
    }

    // CANCEL (customer cancels own, or staff/admin cancels any)
    if ($action === 'cancel') {
        $user = requireLogin();
        $queueId = (int)($data['queue_id'] ?? 0);
        if (!$queueId) jsonResponse(['error' => 'queue_id required'], 400);

        if ($user['role'] === 'customer') {
            $db->prepare('
                UPDATE queues SET queue_status = "cancelled"
                WHERE queue_id = ? AND user_id = ? AND queue_status IN ("waiting")
            ')->execute([$queueId, $user['user_id']]);
        } else {
            $db->prepare('
                UPDATE queues SET queue_status = "cancelled"
                WHERE queue_id = ? AND queue_status IN ("waiting","serving")
            ')->execute([$queueId]);
        }
        jsonResponse(['message' => 'Cancelled']);
    }
}

// ─── DELETE: remove queue record (admin only) ───────────────────────
if ($method === 'DELETE') {
    requireRole('admin');
    $data = json_decode(file_get_contents('php://input'), true);
    $queueId = (int)($data['queue_id'] ?? 0);
    if (!$queueId) jsonResponse(['error' => 'queue_id required'], 400);

    $db->prepare('DELETE FROM queues WHERE queue_id = ?')->execute([$queueId]);
    jsonResponse(['message' => 'Queue record deleted']);
}
