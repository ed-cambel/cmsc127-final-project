<?php
// Cross-Site Request Forgery defenses applied to every API entrypoint.

function requireJsonRequest(): void {
    $method = $_SERVER['REQUEST_METHOD'];
    if (!in_array($method, ['POST', 'PUT', 'DELETE'], true)) return;

    $ct = $_SERVER['CONTENT_TYPE'] ?? '';
    if (stripos($ct, 'application/json') !== 0) {
        jsonResponse(['error' => 'Content-Type must be application/json'], 415);
    }
}

function requireSameOrigin(): void {
    $method = $_SERVER['REQUEST_METHOD'];
    if (!in_array($method, ['POST', 'PUT', 'DELETE'], true)) return;

    $origin  = $_SERVER['HTTP_ORIGIN']  ?? '';
    $referer = $_SERVER['HTTP_REFERER'] ?? '';
    $host    = $_SERVER['HTTP_HOST']    ?? '';

    $check = $origin ?: $referer;
    if (!$check) {
        jsonResponse(['error' => 'Missing Origin/Referer'], 403);
    }
    $parsed = parse_url($check);
    if (($parsed['host'] ?? '') !== $host) {
        jsonResponse(['error' => 'Cross-origin request blocked'], 403);
    }
}
