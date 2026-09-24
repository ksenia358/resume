<?php

declare(strict_types=1);

/**
 * Contact form endpoint: validates the submission, saves it to MySQL
 * and emails it to the site owner.
 *
 * Settings come from config.php, which GitHub Actions generates from
 * repository secrets during deploy (it is never committed).
 * repository secrets during deploy (it is never committed).
 */

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

const RATE_LIMIT_PER_HOUR = 5;

function respond(int $status, array $body): void
{
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_UNICODE);
    exit;
}

function textLength(string $value): int
{
    return function_exists('mb_strlen') ? mb_strlen($value, 'UTF-8') : strlen($value);
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    respond(405, ['ok' => false, 'error' => 'method_not_allowed']);
}

$configFile = __DIR__ . '/config.php';
if (!is_file($configFile)) {
    error_log('contact.php: config.php is missing');
    respond(500, ['ok' => false, 'error' => 'not_configured']);
}
$config = require $configFile;

$input = json_decode((string) file_get_contents('php://input'), true);
if (!is_array($input)) {
    respond(400, ['ok' => false, 'error' => 'invalid_json']);
}

$name = trim((string) ($input['name'] ?? ''));
$email = trim((string) ($input['email'] ?? ''));
$message = trim((string) ($input['message'] ?? ''));

$errors = [];
if ($name === '' || textLength($name) > 200) {
    $errors[] = 'name';
}
if ($email === '' || textLength($email) > 254 || filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
    $errors[] = 'email';
}
if (textLength($message) < 10 || textLength($message) > 5000) {
    $errors[] = 'message';
}
if ($errors) {
    respond(422, ['ok' => false, 'error' => 'validation', 'fields' => $errors]);
}

$ip = (string) ($_SERVER['REMOTE_ADDR'] ?? '');
$userAgent = substr((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 500);

// --- Database (optional: skipped until DB secrets are set) ---
$pdo = null;
$messageId = null;

if (!empty($config['db_name'])) {
    try {
        $pdo = new PDO(
            sprintf('mysql:host=%s;dbname=%s;charset=utf8mb4', $config['db_host'], $config['db_name']),
            (string) $config['db_user'],
            (string) $config['db_password'],
            [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            ]
        );

        $pdo->exec(
            'CREATE TABLE IF NOT EXISTS contact_messages (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(200) NOT NULL,
                email VARCHAR(254) NOT NULL,
                message TEXT NOT NULL,
                ip VARCHAR(45) NOT NULL DEFAULT \'\',
                user_agent VARCHAR(500) NOT NULL DEFAULT \'\',
                mail_sent TINYINT(1) NOT NULL DEFAULT 0,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                KEY idx_ip_created (ip, created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
        );

        $stmt = $pdo->prepare(
            'SELECT COUNT(*) FROM contact_messages WHERE ip = ? AND created_at > NOW() - INTERVAL 1 HOUR'
        );
        $stmt->execute([$ip]);
        if ((int) $stmt->fetchColumn() >= RATE_LIMIT_PER_HOUR) {
            respond(429, ['ok' => false, 'error' => 'too_many_requests']);
        }

        $stmt = $pdo->prepare(
            'INSERT INTO contact_messages (name, email, message, ip, user_agent) VALUES (?, ?, ?, ?, ?)'
        );
        $stmt->execute([$name, $email, $message, $ip, $userAgent]);
        $messageId = (int) $pdo->lastInsertId();
    } catch (PDOException $e) {
        error_log('contact.php: DB error: ' . $e->getMessage());
        $pdo = null;
    }
}

// --- Email ---
$mailSent = false;

if (!empty($config['mail_to']) && !empty($config['mail_from'])) {
    $subject = '=?UTF-8?B?' . base64_encode('Резюме: сообщение от ' . $name) . '?=';
    $body = "Имя: {$name}\nEmail: {$email}\nIP: {$ip}\n\n{$message}\n";
    $headers = implode("\r\n", [
        'From: ' . $config['mail_from'],
        // $email passed FILTER_VALIDATE_EMAIL, so it can't contain header-injecting newlines.
        'Reply-To: ' . $email,
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=UTF-8',
        'Content-Transfer-Encoding: 8bit',
    ]);

    // mail_to is a comma-separated list; each address gets its own copy.
    foreach (array_filter(array_map('trim', explode(',', (string) $config['mail_to']))) as $recipient) {
        if (mail($recipient, $subject, $body, $headers, '-f' . $config['mail_from'])) {
            $mailSent = true;
        } else {
            error_log('contact.php: mail() failed for ' . $recipient);
        }
    }
}

if ($pdo !== null && $messageId !== null && $mailSent) {
    $pdo->prepare('UPDATE contact_messages SET mail_sent = 1 WHERE id = ?')->execute([$messageId]);
}

if ($messageId === null && !$mailSent) {
    respond(500, ['ok' => false, 'error' => 'delivery_failed']);
}

respond(200, ['ok' => true]);
