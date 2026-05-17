<?php
session_set_cookie_params([
    'lifetime' => 0,
    'path'     => '/',
    'httponly' => true,
    'secure'   => !empty($_SERVER['HTTPS']),
    'samesite' => 'Lax',
]);
session_start();

function currentUser(): ?array {
    return $_SESSION['user'] ?? null;
}

function requireLogin(): array {
    $user = currentUser();
    if (!$user) {
        jsonResponse(['error' => 'Not authenticated'], 401);
    }
    return $user;
}

function requireRole(string ...$roles): array {
    $user = requireLogin();
    if (!in_array($user['role'], $roles)) {
        jsonResponse(['error' => 'Forbidden'], 403);
    }
    return $user;
}
