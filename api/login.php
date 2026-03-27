<?php
require_once __DIR__ . '/../config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Sadece POST metodu kabul edilir']);
    exit;
}

$body = getJsonBody();
$username = $body['username'] ?? '';
$password = $body['password'] ?? '';

if (empty($username) || empty($password)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Kullanıcı adı ve şifre gerekli']);
    exit;
}

$data = getPasswordData();
if (!$data) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Sunucu yapılandırma hatası']);
    exit;
}

if ($username === $data['username'] && password_verify($password, $data['password_hash'])) {
    $_SESSION['authenticated'] = true;
    $_SESSION['username'] = $username;

    echo json_encode([
        'success' => true,
        'data' => [
            'message' => 'Giriş başarılı',
            'csrf_token' => $_SESSION['csrf_token']
        ]
    ]);
} else {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Geçersiz kullanıcı adı veya şifre']);
}
