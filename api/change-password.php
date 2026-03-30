<?php
require_once __DIR__ . '/../config.php';
requireAuth();
verifyCsrfToken();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false]);
    exit;
}

$body = getJsonBody();
$oldPassword = $body['old_password'] ?? '';
$newPassword = $body['new_password'] ?? '';

if (empty($oldPassword) || empty($newPassword)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Alle Felder sind erforderlich']);
    exit;
}

if (strlen($newPassword) < 6) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Neues Passwort muss mindestens 6 Zeichen haben']);
    exit;
}

$pwData = getPasswordData();
if (!$pwData || !password_verify($oldPassword, $pwData['password_hash'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Aktuelles Passwort ist falsch']);
    exit;
}

$pwData['password_hash'] = password_hash($newPassword, PASSWORD_DEFAULT);
$pwFile = __DIR__ . '/../password.json';
file_put_contents($pwFile, json_encode($pwData, JSON_PRETTY_PRINT), LOCK_EX);

// Eski session'ları geçersiz kıl: yeni session oluştur
session_regenerate_id(true);
$_SESSION['authenticated'] = true;
$_SESSION['username'] = $pwData['username'];
$_SESSION['bound_ip'] = $_SERVER['REMOTE_ADDR'] ?? '';
$_SESSION['bound_ua'] = $_SERVER['HTTP_USER_AGENT'] ?? '';
$_SESSION['last_activity'] = time();
// Yeni CSRF token oluştur
$_SESSION['csrf_token'] = bin2hex(random_bytes(32));

echo json_encode(['success' => true, 'data' => [
    'message' => 'Passwort erfolgreich geändert',
    'csrf_token' => $_SESSION['csrf_token']
]]);
