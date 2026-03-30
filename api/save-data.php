<?php
require_once __DIR__ . '/../config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Nur POST-Methode erlaubt']);
    exit;
}

requireAuth();
verifyCsrfToken();

$body = getJsonBody();

if (empty($body)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Gültige JSON-Daten erforderlich']);
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
        echo json_encode(['success' => false, 'error' => 'Ungültiges Feld']);
        exit;
    }
    $currentData[$key] = $value;
}

// Input validation: services
if (isset($currentData['services']) && is_array($currentData['services'])) {
    foreach ($currentData['services'] as $i => $svc) {
        if (isset($svc['name']) && mb_strlen($svc['name']) > 200) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Dienstleistungsname zu lang (max 200 Zeichen)']);
            exit;
        }
        if (isset($svc['price'])) {
            $price = floatval($svc['price']);
            if ($price < 0 || $price > 99999) {
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'Ungültiger Preis (0-99999)']);
                exit;
            }
            $currentData['services'][$i]['price'] = $price;
        }
    }
}

// Input validation: products
if (isset($currentData['products']) && is_array($currentData['products'])) {
    foreach ($currentData['products'] as $i => $prod) {
        if (isset($prod['name']) && mb_strlen($prod['name']) > 200) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Produktname zu lang (max 200 Zeichen)']);
            exit;
        }
        if (isset($prod['price'])) {
            $price = floatval($prod['price']);
            if ($price < 0 || $price > 99999) {
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'Ungültiger Preis (0-99999)']);
                exit;
            }
            $currentData['products'][$i]['price'] = $price;
        }
    }
}

// Input validation: contact
if (isset($currentData['contact']) && is_array($currentData['contact'])) {
    $c = $currentData['contact'];
    foreach (['phone', 'phone_display', 'email', 'address', 'maps_url'] as $field) {
        if (isset($c[$field]) && mb_strlen($c[$field]) > 500) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Kontaktfeld zu lang (max 500 Zeichen)']);
            exit;
        }
    }
    if (isset($c['email']) && !empty($c['email']) && !filter_var($c['email'], FILTER_VALIDATE_EMAIL)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Ungültige E-Mail-Adresse']);
        exit;
    }
}

// Backup: data.json.bak erstellen
if (file_exists($dataFile)) {
    copy($dataFile, $dataFile . '.bak');
}

$json = json_encode($currentData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

if ($json === false) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'JSON-Encoding fehlgeschlagen']);
    exit;
}

if (file_put_contents($dataFile, $json . "\n", LOCK_EX) === false) {
    // Fallback: Backup wiederherstellen
    if (file_exists($dataFile . '.bak')) {
        copy($dataFile . '.bak', $dataFile);
    }
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Daten konnten nicht gespeichert werden']);
    exit;
}

echo json_encode(['success' => true, 'data' => ['message' => 'Daten erfolgreich gespeichert']]);
