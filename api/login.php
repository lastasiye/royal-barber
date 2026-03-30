<?php
require_once __DIR__ . '/../config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Nur POST-Methode erlaubt']);
    exit;
}

$body = getJsonBody();
$username = $body['username'] ?? '';
$password = $body['password'] ?? '';

if (empty($username) || empty($password)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Benutzername und Passwort erforderlich']);
    exit;
}

// Rate Limiting: 5 Versuche pro 15 Minuten
checkRateLimit('login', 5, 900);

$data = getPasswordData();
if (!$data) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Serverkonfigurationsfehler']);
    exit;
}

if (strtolower($username) === strtolower($data['username']) && password_verify($password, $data['password_hash'])) {
    // Erfolgreiche Anmeldung: Session erneuern
    session_regenerate_id(true);
    $_SESSION['authenticated'] = true;
    $_SESSION['username'] = $data['username'];
    $_SESSION['bound_ip'] = $_SERVER['REMOTE_ADDR'] ?? '';
    $_SESSION['bound_ua'] = $_SERVER['HTTP_USER_AGENT'] ?? '';
    $_SESSION['last_activity'] = time();

    echo json_encode([
        'success' => true,
        'data' => [
            'message' => 'Anmeldung erfolgreich',
            'csrf_token' => $_SESSION['csrf_token']
        ]
    ]);
} else {
    // Fehlgeschlagene Anmeldung aufzeichnen
    recordRateLimit('login');
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Ungültiger Benutzername oder Passwort']);
}
