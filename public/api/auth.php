<?php

declare(strict_types=1);

/**
 * Admin login for the resume editor.
 *   GET                              → {"authenticated": bool}
 *   POST {"action":"login","password"} → sets the admin cookie
 *   POST {"action":"logout"}         → clears it
 */

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

require __DIR__ . '/lib/auth.php';
require __DIR__ . '/lib/db.php';

const LOGIN_ATTEMPTS_PER_15_MIN = 5;

function respond(int $status, array $body): void
{
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_UNICODE);
    exit;
}

$configFile = __DIR__ . '/config.php';
$config = is_file($configFile) ? require $configFile : [];

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    respond(200, ['authenticated' => isAdmin($config)]);
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: GET, POST');
    respond(405, ['ok' => false, 'error' => 'method_not_allowed']);
}

$input = json_decode((string) file_get_contents('php://input'), true);
$action = is_array($input) ? (string) ($input['action'] ?? '') : '';

if ($action === 'logout') {
    clearAdminCookie();
    respond(200, ['ok' => true]);
}
if ($action !== 'login') {
    respond(400, ['ok' => false, 'error' => 'unknown_action']);
}
if (empty($config['admin_password_hash'])) {
    error_log('auth.php: admin_password_hash is not configured');
    respond(503, ['ok' => false, 'error' => 'not_configured']);
}

// Failed attempts are counted per IP in MySQL; without a database each failure is just slowed down.
$ip = (string) ($_SERVER['REMOTE_ADDR'] ?? '');
$pdo = null;
if (!empty($config['db_name'])) {
    try {
        $pdo = connectDb($config);
        $pdo->exec(
            'CREATE TABLE IF NOT EXISTS admin_login_failures (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                ip VARCHAR(45) NOT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                KEY idx_ip_created (ip, created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
        );
        $stmt = $pdo->prepare(
            'SELECT COUNT(*) FROM admin_login_failures WHERE ip = ? AND created_at > NOW() - INTERVAL 15 MINUTE'
        );
        $stmt->execute([$ip]);
        if ((int) $stmt->fetchColumn() >= LOGIN_ATTEMPTS_PER_15_MIN) {
            respond(429, ['ok' => false, 'error' => 'too_many_attempts']);
        }
    } catch (PDOException $e) {
        error_log('auth.php: DB error: ' . $e->getMessage());
        $pdo = null;
    }
}

if (!password_verify((string) ($input['password'] ?? ''), (string) $config['admin_password_hash'])) {
    if ($pdo !== null) {
        $pdo->prepare('INSERT INTO admin_login_failures (ip) VALUES (?)')->execute([$ip]);
    }
    sleep(1);
    respond(401, ['ok' => false, 'error' => 'wrong_password']);
}

setAdminCookie($config);
respond(200, ['ok' => true]);
