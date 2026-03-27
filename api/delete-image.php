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
$id = $body['id'] ?? '';

if (empty($id)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Bild-ID fehlt']);
    exit;
}

$dataFile = __DIR__ . '/../data.json';
$data = json_decode(file_get_contents($dataFile), true);

$found = false;
foreach ($data['gallery'] as $idx => $item) {
    if ((string)$item['id'] === (string)$id) {
        $filePath = __DIR__ . '/../' . $item['src'];
        if (file_exists($filePath)) {
            unlink($filePath);
        }
        array_splice($data['gallery'], $idx, 1);
        $found = true;
        break;
    }
}

if (!$found) {
    http_response_code(404);
    echo json_encode(['success' => false, 'error' => 'Bild nicht gefunden']);
    exit;
}

$data['gallery'] = array_values($data['gallery']);
file_put_contents($dataFile, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), LOCK_EX);

echo json_encode(['success' => true]);
