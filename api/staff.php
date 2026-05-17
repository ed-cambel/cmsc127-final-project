<?php
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/csrf.php';

requireJsonRequest();
requireSameOrigin();

$method = $_SERVER['REQUEST_METHOD'];
$db     = getDB();

// GET — list staff with user and service info
if ($method === 'GET') {
    $rows = $db->query('
        SELECT st.staff_id, st.user_id, u.username, st.assigned_service_id,
               s.service_name, st.staff_role
        FROM staff st
        JOIN users u    ON st.user_id             = u.user_id
        JOIN services s ON st.assigned_service_id  = s.service_id
        ORDER BY st.staff_id
    ')->fetchAll();
    jsonResponse(['staff' => $rows]);
}

// POST — assign staff (admin)
if ($method === 'POST') {
    requireRole('admin');
    $data = json_decode(file_get_contents('php://input'), true);
    $userId    = (int)($data['user_id'] ?? 0);
    $serviceId = (int)($data['assigned_service_id'] ?? 0);
    $role      = trim($data['staff_role'] ?? '');

    if (!$userId || !$serviceId || !$role) {
        jsonResponse(['error' => 'user_id, assigned_service_id, staff_role required'], 400);
    }

    $stmt = $db->prepare('INSERT INTO staff (user_id, assigned_service_id, staff_role) VALUES (?, ?, ?)');
    $stmt->execute([$userId, $serviceId, $role]);
    jsonResponse(['message' => 'Staff assigned', 'staff_id' => (int)$db->lastInsertId()], 201);
}

// PUT — update assignment (admin)
if ($method === 'PUT') {
    requireRole('admin');
    $data = json_decode(file_get_contents('php://input'), true);
    $staffId   = (int)($data['staff_id'] ?? 0);
    $serviceId = (int)($data['assigned_service_id'] ?? 0);
    $role      = trim($data['staff_role'] ?? '');

    if (!$staffId || !$serviceId || !$role) {
        jsonResponse(['error' => 'staff_id, assigned_service_id, staff_role required'], 400);
    }

    $stmt = $db->prepare('UPDATE staff SET assigned_service_id = ?, staff_role = ? WHERE staff_id = ?');
    $stmt->execute([$serviceId, $role, $staffId]);
    jsonResponse(['message' => 'Staff updated']);
}

// DELETE
if ($method === 'DELETE') {
    requireRole('admin');
    $data = json_decode(file_get_contents('php://input'), true);
    $staffId = (int)($data['staff_id'] ?? 0);
    if (!$staffId) jsonResponse(['error' => 'staff_id required'], 400);

    $db->prepare('DELETE FROM staff WHERE staff_id = ?')->execute([$staffId]);
    jsonResponse(['message' => 'Staff removed']);
}
