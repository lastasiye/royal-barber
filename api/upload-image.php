<?php
require_once __DIR__ . '/../config.php';
requireAuth();
verifyCsrfToken();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false]);
    exit;
}

$allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
$allowedExts = ['jpg', 'jpeg', 'png', 'webp'];
$maxSize = 5 * 1024 * 1024;

if (!isset($_FILES['image'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Keine Datei']);
    exit;
}

$file = $_FILES['image'];

if ($file['error'] !== UPLOAD_ERR_OK) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Upload-Fehler']);
    exit;
}

if ($file['size'] > $maxSize) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Datei zu gross (max 5MB)']);
    exit;
}

// Uzantı kontrolü (whitelist)
$ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
if (!in_array($ext, $allowedExts, true)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Nur JPG, PNG, WebP erlaubt']);
    exit;
}

// Gerçek MIME type kontrolü (finfo - sunucu tarafı)
$finfo = new finfo(FILEINFO_MIME_TYPE);
$realMime = $finfo->file($file['tmp_name']);
if (!in_array($realMime, $allowedMimes, true)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Ungültiger Dateityp (MIME: ' . $realMime . ')']);
    exit;
}

// Dosya adı oluştur (path traversal koruması)
$newName = uniqid('img_') . '.' . $ext;
$uploadsDir = __DIR__ . '/../uploads';
$dest = $uploadsDir . '/' . $newName;

// realpath ile path traversal kontrolü
if (!is_dir($uploadsDir)) {
    mkdir($uploadsDir, 0755, true);
}
$realDest = realpath($uploadsDir) . DIRECTORY_SEPARATOR . $newName;
if (strpos($realDest, realpath($uploadsDir)) !== 0) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Ungültiger Dateipfad']);
    exit;
}

if (!move_uploaded_file($file['tmp_name'], $realDest)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Datei konnte nicht gespeichert werden']);
    exit;
}

$dataFile = __DIR__ . '/../data.json';
$data = json_decode(file_get_contents($dataFile), true);
$data['gallery'][] = ['id' => uniqid(), 'src' => 'uploads/' . $newName, 'alt' => 'Galerie'];
file_put_contents($dataFile, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);

echo json_encode(['success' => true, 'filename' => $newName]);
