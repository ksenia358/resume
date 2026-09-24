<?php

declare(strict_types=1);

/**
 * Contact form endpoint: validates the submission, saves it to MySQL
 * and emails it to the site owner.
 *
 * Settings come from config.php, which GitHub Actions generates from
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

/**
 * Minimal SMTP client (implicit TLS + AUTH LOGIN), so mail goes out through the hosting's
 * mail server as a real mailbox instead of PHP's mail(). Returns null on success or an error.
 */
function smtpSend(array $config, string $to, string $subject, array $headers, string $encodedBody): ?string
{
    $host = (string) ($config['smtp_host'] ?? 'smtp.spaceweb.ru');
    $port = (int) ($config['smtp_port'] ?? 465);
    $user = (string) ($config['smtp_user'] ?? '') ?: (string) $config['mail_from'];

    $socket = @stream_socket_client("ssl://{$host}:{$port}", $errno, $errstr, 15);
    if ($socket === false) {
        return "connect {$host}:{$port}: {$errstr}";
    }
    stream_set_timeout($socket, 15);

    // Reads a (possibly multi-line) reply and checks its status code.
    $expect = function (string $code) use ($socket): ?string {
        $reply = '';
        while (($line = fgets($socket, 515)) !== false) {
            $reply .= $line;
            if (strlen($line) < 4 || $line[3] === ' ') {
                break;
            }
        }
        return strncmp($reply, $code, 3) === 0 ? null : (trim($reply) ?: 'no reply');
    };
    $command = function (string $line, string $code) use ($socket, $expect): ?string {
        fwrite($socket, $line . "\r\n");
        return $expect($code);
    };

    $message = implode("\r\n", array_merge(
        ['Date: ' . date('r'), 'To: ' . $to, 'Subject: ' . $subject],
        $headers
    )) . "\r\n\r\n" . $encodedBody;

    $steps = [
        fn () => $expect('220'),
        fn () => $command('EHLO ' . ($_SERVER['SERVER_NAME'] ?? 'localhost'), '250'),
        fn () => $command('AUTH LOGIN', '334'),
        fn () => $command(base64_encode($user), '334'),
        fn () => $command(base64_encode((string) $config['smtp_password']), '235'),
        fn () => $command('MAIL FROM:<' . $config['mail_from'] . '>', '250'),
        fn () => $command('RCPT TO:<' . $to . '>', '250'),
        fn () => $command('DATA', '354'),
        // Base64 body lines never start with "." so no dot-stuffing is needed.
        fn () => $command($message . "\r\n.", '250'),
    ];

    $error = null;
    foreach ($steps as $step) {
        if (($error = $step()) !== null) {
            break;
        }
    }
    fwrite($socket, "QUIT\r\n");
    fclose($socket);

    return $error;
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
$mailError = 'not_configured';

if (!empty($config['mail_to']) && !empty($config['mail_from'])) {
    $from = (string) $config['mail_from'];
    $subject = '=?UTF-8?B?' . base64_encode('Резюме: сообщение от ' . $name) . '?=';
    $body = "Имя: {$name}\nEmail: {$email}\nIP: {$ip}\n\n{$message}\n";
    $headers = [
        'From: ' . $from,
        // $email passed FILTER_VALIDATE_EMAIL, so it can't contain header-injecting newlines.
        'Reply-To: ' . $email,
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=UTF-8',
        'Content-Transfer-Encoding: base64',
    ];
    $encodedBody = chunk_split(base64_encode($body));

    // mail_to is a comma-separated list; each address gets its own copy.
    foreach (array_filter(array_map('trim', explode(',', (string) $config['mail_to']))) as $recipient) {
        if (!empty($config['smtp_password'])) {
            $error = smtpSend($config, $recipient, $subject, $headers, $encodedBody);
            $sent = $error === null;
            if (!$sent) {
                error_log("contact.php: SMTP to {$recipient} failed: {$error}");
            }
        } else {
            $sent = mail($recipient, $subject, $encodedBody, implode("\r\n", $headers), '-f' . $from);
            if (!$sent) {
                error_log("contact.php: mail() to {$recipient} failed");
            }
        }
        if ($sent) {
            $mailSent = true;
        }
    }
    $mailError = $mailSent ? null : 'failed';
}

if ($pdo !== null && $messageId !== null && $mailSent) {
    $pdo->prepare('UPDATE contact_messages SET mail_sent = 1 WHERE id = ?')->execute([$messageId]);
}

if ($messageId === null && !$mailSent) {
    // Status codes only (no details) so a failed deploy can be diagnosed from the browser.
    respond(500, [
        'ok' => false,
        'error' => 'delivery_failed',
        'db' => empty($config['db_name']) ? 'not_configured' : 'failed',
        'mail' => $mailError,
        'transport' => empty($config['smtp_password']) ? 'mail()' : 'smtp',
    ]);
}

respond(200, ['ok' => true]);
