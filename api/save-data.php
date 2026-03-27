<?php
require_once __DIR__ . '/../config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Sadece POST metodu kabul edilir']);
    exit;
}

requireAuth();
verifyCsrfToken();

$body = getJsonBody();

if (empty($body)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Geçerli JSON verisi gerekli']);
    exit;
}

$dataFile = __DIR__ . '/../data.json';

$currentData = [];
if (file_exists($dataFile)) {
    $currentData = json_decode(file_get_contents($dataFile), true) ?? [];
}

$allowedKeys = ['gallery', 'services', 'products', 'hours', 'contact'];
foreach ($body as $key => $value) {
    if (!in_array($key, $allowedKeys, true)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => "Geçersiz alan: $key"]);
        exit;
    }
    $currentData[$key] = $value;
}

$json = json_encode($currentData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

if (file_put_contents($dataFile, $json . "\n", LOCK_EX) === false) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Veri kaydedilemedi']);
    exit;
}

echo json_encode(['success' => true, 'data' => ['message' => 'Veriler başarıyla kaydedildi']]);
