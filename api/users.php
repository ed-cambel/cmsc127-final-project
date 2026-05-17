<?php
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/csrf.php';

requireJsonRequest();
requireSameOrigin();

$method = $_SERVER['REQUEST_METHOD'];
$db     = getDB();

// GET — list users (staff/admin can see all; customer sees self)
if ($method === 'GET') {
    $user = requireLogin();
    if (in_array($user['role'], ['admin', 'staff'])) {
        $rows = $db->query('SELECT user_id, username, role, created_at FROM users ORDER BY user_id')->fetchAll();
    } else {
        $stmt = $db->prepare('SELECT user_id, username, role, created_at FROM users WHERE user_id = ?');
        $stmt->execute([$user['user_id']]);
        $rows = $stmt->fetchAll();
    }
    jsonResponse(['users' => $rows]);
}

// POST — create user (admin)
if ($method === 'POST') {
    requireRole('admin');
    $data = json_decode(file_get_contents('php://input'), true);
    $username = trim($data['username'] ?? '');
    $password = $data['password'] ?? '';
    $role     = $data['role'] ?? 'customer';

    if (!$username || !$password) jsonResponse(['error' => 'username and password required'], 400);
    if (!in_array($role, ['customer', 'staff', 'admin'])) jsonResponse(['error' => 'Invalid role'], 400);

    $hash = password_hash($password, PASSWORD_DEFAULT);
    $stmt = $db->prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)');
    try {
        $stmt->execute([$username, $hash, $role]);
    } catch (PDOException $e) {
        if ($e->getCode() == 23000) jsonResponse(['error' => 'Username already taken'], 409);
        throw $e;
    }
    jsonResponse(['message' => 'User created', 'user_id' => (int)$db->lastInsertId()], 201);
}

// PUT — update user (admin)
if ($method === 'PUT') {
    requireRole('admin');
    $data = json_decode(file_get_contents('php://input'), true);
    $userId   = (int)($data['user_id'] ?? 0);
    $username = trim($data['username'] ?? '');
    $role     = $data['role'] ?? '';

    if (!$userId || !$username || !$role) jsonResponse(['error' => 'user_id, username, role required'], 400);

    $sql = 'UPDATE users SET username = ?, role = ?';
    $params = [$username, $role];

    if (!empty($data['password'])) {
        $sql .= ', password_hash = ?';
        $params[] = password_hash($data['password'], PASSWORD_DEFAULT);
    }
    $sql .= ' WHERE user_id = ?';
    $params[] = $userId;

    $db->prepare($sql)->execute($params);
    jsonResponse(['message' => 'User updated']);
}

// DELETE
if ($method === 'DELETE') {
    requireRole('admin');
    $data = json_decode(file_get_contents('php://input'), true);
    $userId = (int)($data['user_id'] ?? 0);
    if (!$userId) jsonResponse(['error' => 'user_id required'], 400);

    $db->prepare('DELETE FROM users WHERE user_id = ?')->execute([$userId]);
    jsonResponse(['message' => 'User deleted']);
}
