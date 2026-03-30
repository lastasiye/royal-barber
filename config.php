<?php
// Session güvenlik ayarları
ini_set('session.cookie_httponly', 1);
ini_set('session.cookie_samesite', 'Strict');
ini_set('session.use_strict_mode', 1);
if (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on') {
    ini_set('session.cookie_secure', 1);
}
session_start();

// CORS headers
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');

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

// Rate Limiting (dosya tabanlı)
function checkRateLimit($action = 'login', $maxAttempts = 5, $windowSeconds = 900) {
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $file = __DIR__ . '/rate_limit.json';
    $data = [];
    if (file_exists($file)) {
        $data = json_decode(file_get_contents($file), true) ?? [];
    }
    $key = $action . ':' . $ip;
    $now = time();

    // Eski girişleri temizle
    if (isset($data[$key])) {
        $data[$key] = array_filter($data[$key], fn($t) => ($now - $t) < $windowSeconds);
        $data[$key] = array_values($data[$key]);
    }

    if (isset($data[$key]) && count($data[$key]) >= $maxAttempts) {
        $remaining = $windowSeconds - ($now - $data[$key][0]);
        http_response_code(429);
        echo json_encode(['success' => false, 'error' => "Zu viele Versuche. Bitte warten Sie $remaining Sekunden."]);
        file_put_contents($file, json_encode($data), LOCK_EX);
        exit;
    }

    return $data;
}

function recordRateLimit($action = 'login') {
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $file = __DIR__ . '/rate_limit.json';
    $data = [];
    if (file_exists($file)) {
        $data = json_decode(file_get_contents($file), true) ?? [];
    }
    $key = $action . ':' . $ip;
    if (!isset($data[$key])) $data[$key] = [];
    $data[$key][] = time();
    file_put_contents($file, json_encode($data), LOCK_EX);
}

// HTML-Sonderzeichen escapen (XSS-Schutz)
function escapeHtml($str) {
    return htmlspecialchars($str, ENT_QUOTES | ENT_HTML5, 'UTF-8');
}
