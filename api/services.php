<?php
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/csrf.php';

requireJsonRequest();
requireSameOrigin();

$method = $_SERVER['REQUEST_METHOD'];
$db     = getDB();

// GET — list all services (with location name)
if ($method === 'GET') {
    $rows = $db->query('
        SELECT s.service_id, s.service_name, s.description,
               s.location_id, l.building_name
        FROM services s
        JOIN locations l ON s.location_id = l.location_id
        ORDER BY s.service_id
    ')->fetchAll();
    jsonResponse(['services' => $rows]);
}

// POST — create service (admin only)
if ($method === 'POST') {
    requireRole('admin');
    $data = json_decode(file_get_contents('php://input'), true);
    $name = trim($data['service_name'] ?? '');
    $desc = trim($data['description'] ?? '');
    $locId = (int)($data['location_id'] ?? 0);

    if (!$name || !$locId) {
        jsonResponse(['error' => 'service_name and location_id required'], 400);
    }

    $stmt = $db->prepare('INSERT INTO services (service_name, description, location_id) VALUES (?, ?, ?)');
    $stmt->execute([$name, $desc, $locId]);
    jsonResponse(['message' => 'Service created', 'service_id' => (int)$db->lastInsertId()], 201);
}

// PUT — update service (admin only)
if ($method === 'PUT') {
    requireRole('admin');
    $data = json_decode(file_get_contents('php://input'), true);
    $id   = (int)($data['service_id'] ?? 0);
    $name = trim($data['service_name'] ?? '');
    $desc = trim($data['description'] ?? '');
    $locId = (int)($data['location_id'] ?? 0);

    if (!$id || !$name || !$locId) {
        jsonResponse(['error' => 'service_id, service_name, location_id required'], 400);
    }

    $stmt = $db->prepare('UPDATE services SET service_name = ?, description = ?, location_id = ? WHERE service_id = ?');
    $stmt->execute([$name, $desc, $locId, $id]);
    jsonResponse(['message' => 'Service updated']);
}

// DELETE — delete service (admin only)
if ($method === 'DELETE') {
    requireRole('admin');
    $data = json_decode(file_get_contents('php://input'), true);
    $id   = (int)($data['service_id'] ?? 0);
    if (!$id) jsonResponse(['error' => 'service_id required'], 400);

    $stmt = $db->prepare('DELETE FROM services WHERE service_id = ?');
    $stmt->execute([$id]);
    jsonResponse(['message' => 'Service deleted']);
}
