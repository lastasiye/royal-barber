<?php
require_once __DIR__ . '/../config.php';
requireAuth();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false]);
    exit;
}

$allowed = ['image/jpeg', 'image/png', 'image/webp'];
$maxSize = 5 * 1024 * 1024;

if (!isset($_FILES['image'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Keine Datei']);
    exit;
}

$file = $_FILES['image'];

if ($file['size'] > $maxSize) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Datei zu gross (max 5MB)']);
    exit;
}

if (!in_array($file['type'], $allowed)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Nur JPG, PNG, WebP']);
    exit;
}

$ext = pathinfo($file['name'], PATHINFO_EXTENSION);
$newName = uniqid('img_') . '.' . $ext;
$dest = __DIR__ . '/../uploads/' . $newName;

move_uploaded_file($file['tmp_name'], $dest);

$dataFile = __DIR__ . '/../data.json';
$data = json_decode(file_get_contents($dataFile), true);
$data['gallery'][] = ['id' => uniqid(), 'src' => 'uploads/' . $newName, 'alt' => 'Galerie'];
file_put_contents($dataFile, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

echo json_encode(['success' => true, 'filename' => $newName]);
