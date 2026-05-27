<?php
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/csrf.php';

requireJsonRequest();
requireSameOrigin();

$method = $_SERVER['REQUEST_METHOD'];
$db     = getDB();

if ($method === 'GET') {
    $rows = $db->query('SELECT location_id, building_name FROM locations ORDER BY location_id')->fetchAll();
    jsonResponse(['locations' => $rows]);
}

if ($method === 'POST') {
    requireRole('admin');
    $data = json_decode(file_get_contents('php://input'), true);
    $name = trim($data['building_name'] ?? '');
    if (!$name) jsonResponse(['error' => 'building_name required'], 400);

    $stmt = $db->prepare('INSERT INTO locations (building_name) VALUES (?)');
    $stmt->execute([$name]);
    jsonResponse(['message' => 'Location created', 'location_id' => (int)$db->lastInsertId()], 201);
}

if ($method === 'PUT') {
    requireRole('admin');
    $data = json_decode(file_get_contents('php://input'), true);
    $id   = (int)($data['location_id'] ?? 0);
    $name = trim($data['building_name'] ?? '');
    if (!$id || !$name) jsonResponse(['error' => 'location_id and building_name required'], 400);

    $db->prepare('UPDATE locations SET building_name = ? WHERE location_id = ?')->execute([$name, $id]);
    jsonResponse(['message' => 'Location updated']);
}

if ($method === 'DELETE') {
    requireRole('admin');
    $data = json_decode(file_get_contents('php://input'), true);
    $id = (int)($data['location_id'] ?? 0);
    if (!$id) jsonResponse(['error' => 'location_id required'], 400);

    $db->prepare('DELETE FROM locations WHERE location_id = ?')->execute([$id]);
    jsonResponse(['message' => 'Location deleted']);
}
