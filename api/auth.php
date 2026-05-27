<?php
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/csrf.php';

requireJsonRequest();
requireSameOrigin();

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

if ($method === 'POST' && $action === 'login') {
    $data = json_decode(file_get_contents('php://input'), true);
    $username = trim($data['username'] ?? '');
    $password = $data['password'] ?? '';

    if (!$username || !$password) {
        jsonResponse(['error' => 'Username and password required'], 400);
    }

    $db = getDB();
    $stmt = $db->prepare('SELECT user_id, username, password_hash, role FROM users WHERE username = ?');
    $stmt->execute([$username]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($password, $user['password_hash'])) {
        jsonResponse(['error' => 'Invalid credentials'], 401);
    }

    session_regenerate_id(true);
    $_SESSION['user'] = [
        'user_id'  => (int)$user['user_id'],
        'username' => $user['username'],
        'role'     => $user['role'],
    ];
    jsonResponse(['user' => $_SESSION['user']]);
}

if ($method === 'POST' && $action === 'register') {
    $data = json_decode(file_get_contents('php://input'), true);
    $username = trim($data['username'] ?? '');
    $password = $data['password'] ?? '';

    if (!$username || !$password) {
        jsonResponse(['error' => 'Username and password required'], 400);
    }
    if (strlen($username) < 3 || strlen($username) > 50) {
        jsonResponse(['error' => 'Username must be 3-50 characters'], 400);
    }
    if (!preg_match('/^[A-Za-z0-9_]+$/', $username)) {
        jsonResponse(['error' => 'Username may contain only letters, numbers, and underscores'], 400);
    }
    if (strlen($password) < 8) {
        jsonResponse(['error' => 'Password must be at least 8 characters'], 400);
    }

    $db = getDB();
    $hash = password_hash($password, PASSWORD_DEFAULT);
    $stmt = $db->prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, "customer")');
    try {
        $stmt->execute([$username, $hash]);
    } catch (PDOException $e) {
        if ($e->getCode() == 23000) jsonResponse(['error' => 'Username already taken'], 409);
        throw $e;
    }

    session_regenerate_id(true);
    $_SESSION['user'] = [
        'user_id'  => (int)$db->lastInsertId(),
        'username' => $username,
        'role'     => 'customer',
    ];
    jsonResponse(['message' => 'Account created', 'user' => $_SESSION['user']], 201);
}

if ($method === 'POST' && $action === 'logout') {
    session_destroy();
    jsonResponse(['message' => 'Logged out']);
}

if ($method === 'GET' && $action === 'session') {
    $user = currentUser();
    if ($user) {
        jsonResponse(['user' => $user]);
    }
    jsonResponse(['user' => null]);
}

jsonResponse(['error' => 'Invalid action'], 400);
