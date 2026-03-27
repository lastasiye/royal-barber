<?php
session_start();

// CORS headers
header('Content-Type: application/json; charset=utf-8');

// CSRF-Token erstellen
if (empty($_SESSION['csrf_token'])) {
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
}

// Passwort-Datei lesen
function getPasswordData() {
    $file = __DIR__ . '/password.json';
    if (!file_exists($file)) {
        return null;
    }
    return json_decode(file_get_contents($file), true);
}

// Sitzungsprüfung
function isAuthenticated() {
    return isset($_SESSION['authenticated']) && $_SESSION['authenticated'] === true;
}

// CSRF-Token validieren
function verifyCsrfToken() {
    $headers = getallheaders();
    $token = $headers['X-CSRF-Token'] ?? ($_POST['csrf_token'] ?? '');
    if (empty($token) || $token !== $_SESSION['csrf_token']) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Ungültiges CSRF-Token']);
        exit;
    }
}

// Authentifizierung erforderlich
function requireAuth() {
    if (!isAuthenticated()) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Anmeldung erforderlich']);
        exit;
    }
}

// JSON-Body parsen
function getJsonBody() {
    $input = file_get_contents('php://input');
    return json_decode($input, true) ?? [];
}
