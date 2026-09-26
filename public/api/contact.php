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

/**
 * Sends the response and closes the connection, but keeps the script running,
 * so slow follow-up work (Telegram) doesn't keep the visitor waiting.
 */
function respondAndContinue(int $status, array $body): void
{
    ignore_user_abort(true);
    set_time_limit(120);
    $json = json_encode($body, JSON_UNESCAPED_UNICODE);
    http_response_code($status);
    header('Content-Length: ' . strlen($json));
    header('Connection: close');
    echo $json;
    if (function_exists('fastcgi_finish_request')) {
        fastcgi_finish_request();
    } else {
        while (ob_get_level() > 0) {
            ob_end_flush();
        }
        flush();
    }
}

function textLength(string $value): int
{
    return function_exists('mb_strlen') ? mb_strlen($value, 'UTF-8') : strlen($value);
}

/**
 * Minimal SMTP client (AUTH LOGIN over TLS), so mail goes out through the hosting's
 * mail server as a real mailbox instead of PHP's mail(). Returns null on success or an error.
 *
 * The hosting blocks some outgoing ports (465 is refused on sweb), so ports are tried in turn;
 * only connection failures move on to the next one — auth or recipient errors would just repeat.
 */
function smtpSend(array $config, string $to, string $subject, array $headers, string $encodedBody): ?string
{
    $host = (string) ($config['smtp_host'] ?? 'smtp.spaceweb.ru');
    $message = implode("\r\n", array_merge(
        ['Date: ' . date('r'), 'To: ' . $to, 'Subject: ' . $subject],
        $headers
    )) . "\r\n\r\n" . $encodedBody;

    $errors = [];
    foreach ([['ssl', 465], ['tcp', 2525], ['tcp', 587], ['tcp', 25]] as [$scheme, $port]) {
        $error = smtpSendVia($scheme, $host, $port, $config, $to, $message);
        if ($error === null) {
            return null;
        }
        $errors[] = "{$host}:{$port} {$error}";
        if (strncmp($error, 'connect:', 8) !== 0) {
            break;
        }
    }

    return implode('; ', $errors);
}

// "ssl" connects with implicit TLS; "tcp" upgrades the plain connection with STARTTLS.
function smtpSendVia(string $scheme, string $host, int $port, array $config, string $to, string $message): ?string
{
    $context = stream_context_create(['ssl' => ['peer_name' => $host]]);
    $socket = @stream_socket_client("{$scheme}://{$host}:{$port}", $errno, $errstr, 8, STREAM_CLIENT_CONNECT, $context);
    if ($socket === false) {
        // TLS failures leave $errstr empty; the real reason is in the suppressed warning.
        return 'connect: ' . ($errstr ?: (error_get_last()['message'] ?? 'unknown error'));
    }
    stream_set_timeout($socket, 15);

    // Reads a (possibly multi-line) reply.
    $read = function () use ($socket): string {
        $reply = '';
        while (($line = fgets($socket, 515)) !== false) {
            $reply .= $line;
            if (strlen($line) < 4 || $line[3] === ' ') {
                break;
            }
        }
        return $reply;
    };
    $check = fn (string $reply, string $code): ?string => strncmp($reply, $code, 3) === 0 ? null : (trim($reply) ?: 'no reply');
    $command = function (string $line, string $code) use ($socket, $read, $check): ?string {
        fwrite($socket, $line . "\r\n");
        return $check($read(), $code);
    };
    $ehlo = 'EHLO ' . ($_SERVER['SERVER_NAME'] ?? 'localhost');
    $user = (string) ($config['smtp_user'] ?? '') ?: (string) $config['mail_from'];

    $error = $check($read(), '220');
    if ($error === null && $scheme === 'tcp') {
        fwrite($socket, $ehlo . "\r\n");
        $capabilities = $read();
        $error = $check($capabilities, '250');
        if ($error === null && stripos($capabilities, 'STARTTLS') === false) {
            // Never send the password over an unencrypted connection.
            $error = 'server does not offer STARTTLS';
        }
        if ($error === null) {
            $error = $command('STARTTLS', '220');
        }
        if ($error === null) {
            $methods = STREAM_CRYPTO_METHOD_TLS_CLIENT;
            if (defined('STREAM_CRYPTO_METHOD_TLSv1_3_CLIENT')) {
                $methods |= STREAM_CRYPTO_METHOD_TLSv1_3_CLIENT;
            }
            if (@stream_socket_enable_crypto($socket, true, $methods) !== true) {
                $error = 'STARTTLS handshake failed: ' . (error_get_last()['message'] ?? 'unknown error');
            }
        }
    }

    $steps = [
        fn () => $command($ehlo, '250'),
        fn () => $command('AUTH LOGIN', '334'),
        fn () => $command(base64_encode($user), '334'),
        fn () => $command(base64_encode((string) $config['smtp_password']), '235'),
        fn () => $command('MAIL FROM:<' . $config['mail_from'] . '>', '250'),
        fn () => $command('RCPT TO:<' . $to . '>', '250'),
        fn () => $command('DATA', '354'),
        // Base64 body lines never start with "." so no dot-stuffing is needed.
        fn () => $command($message . "\r\n.", '250'),
    ];
    foreach ($steps as $step) {
        if ($error !== null) {
            break;
        }
        $error = $step();
    }

    fwrite($socket, "QUIT\r\n");
    fclose($socket);

    return $error;
}

/**
 * Sends a plain-text message through the Telegram Bot API. Returns null on success or an error.
 *
 * The hosting can't reach api.telegram.org, so with $relayUrl the request goes through
 * a relay (deploy/telegram-bot.gs on Google Apps Script) that forwards it to Telegram.
 */
function telegramSend(string $token, string $chatId, string $text, string $relayUrl = ''): ?string
{
    $fields = ['chat_id' => $chatId, 'text' => $text, 'disable_web_page_preview' => 'true'];
    if ($relayUrl !== '') {
        $url = $relayUrl;
        $fields['token'] = $token;
    } else {
        $url = 'https://api.telegram.org/bot' . $token . '/sendMessage';
    }
    $payload = http_build_query($fields);

    if (function_exists('curl_init')) {
        $curl = curl_init($url);
        curl_setopt_array($curl, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $payload,
            CURLOPT_RETURNTRANSFER => true,
            // The hosting reaches Telegram slowly; this runs after the response, so waiting is fine.
            CURLOPT_CONNECTTIMEOUT => 30,
            CURLOPT_TIMEOUT => 60,
            // A dead IPv6 route is a common cause of hanging connects.
            CURLOPT_IPRESOLVE => CURL_IPRESOLVE_V4,
            // Apps Script answers with a redirect to the result.
            CURLOPT_FOLLOWLOCATION => true,
        ]);
        $response = curl_exec($curl);
        $transportError = $response === false ? curl_error($curl) : null;
        curl_close($curl);
    } else {
        $response = @file_get_contents($url, false, stream_context_create(['http' => [
            'method' => 'POST',
            'header' => 'Content-Type: application/x-www-form-urlencoded',
            'content' => $payload,
            'timeout' => 60,
            'ignore_errors' => true,
        ]]));
        $transportError = $response === false ? (error_get_last()['message'] ?? 'request failed') : null;
    }

    if ($transportError !== null) {
        // The token may be part of the URL, so keep it out of error messages.
        return str_replace($token, '***', $transportError);
    }
    $result = json_decode((string) $response, true);
    return !empty($result['ok']) ? null : (string) ($result['description'] ?? 'unexpected response');
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
        // The hosting ignores the charset in the DSN; without this Cyrillic is saved as garbage.
        $pdo->exec('SET NAMES utf8mb4');

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
$mailDetails = [];
$mailVia = [];

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
        $sent = false;
        if (!empty($config['smtp_password'])) {
            $error = smtpSend($config, $recipient, $subject, $headers, $encodedBody);
            $sent = $error === null;
            if ($sent) {
                $mailVia[] = 'smtp';
            }
            if (!$sent) {
                error_log("contact.php: SMTP to {$recipient} failed: {$error}");
                // The response is public, so recipient addresses are masked.
                $mailDetails[] = str_replace($recipient, '***', $error);
            }
        }
        // Shared hosting may block outgoing SMTP entirely; its local mail() is the fallback.
        if (!$sent) {
            $headerBlock = implode("\r\n", $headers);
            error_clear_last(); // so a leftover SMTP warning isn't reported as the mail() reason
            $sent = mail($recipient, $subject, $encodedBody, $headerBlock, '-f' . $from)
                || mail($recipient, $subject, $encodedBody, $headerBlock);
            // mail() only hands the letter to the local MTA; it can still be dropped later.
            $mailVia[] = $sent ? 'mail()' : 'failed';
            if (!$sent) {
                $lastError = error_get_last()['message'] ?? 'returned false';
                error_log("contact.php: mail() to {$recipient} failed: {$lastError}");
                $mailDetails[] = "mail(): {$lastError}";
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

$delivered = $messageId !== null || $mailSent;
$telegramConfigured = !empty($config['telegram_bot_token']) && !empty($config['telegram_chat_id']);

$sendTelegram = function () use ($config, $name, $email, $message): ?string {
    $text = "Сообщение с сайта-резюме\n\nИмя: {$name}\nEmail: {$email}\n\n{$message}";
    if (textLength($text) > 4000) {
        $text = (function_exists('mb_substr') ? mb_substr($text, 0, 4000, 'UTF-8') : substr($text, 0, 4000)) . '…';
    }
    $error = telegramSend(
        (string) $config['telegram_bot_token'],
        (string) $config['telegram_chat_id'],
        $text,
        (string) ($config['telegram_relay_url'] ?? '')
    );
    if ($error !== null) {
        error_log("contact.php: Telegram failed: {$error}");
    }
    return $error;
};

// ?debug=telegram waits for Telegram and reports its result, to diagnose delivery from the browser.
$waitForTelegram = $telegramConfigured && ($_GET['debug'] ?? '') === 'telegram';
$telegramStatus = $telegramConfigured ? 'queued' : 'not_configured';
$telegramSeconds = null;
if ($waitForTelegram) {
    $started = microtime(true);
    set_time_limit(120);
    $telegramStatus = $sendTelegram() ?? 'sent';
    $telegramSeconds = round(microtime(true) - $started, 1);
}

// Delivery status (no secrets or addresses) so it can be checked in the browser's Network tab.
respondAndContinue($delivered ? 200 : 500, [
    'ok' => $delivered,
    'db' => $messageId !== null ? 'saved' : (empty($config['db_name']) ? 'not_configured' : 'failed'),
    'mail' => $mailSent ? 'sent' : $mailError,
    'mail_via' => $mailVia,
    // SMTP server replies / connection errors; they never include the password.
    'mail_details' => array_values(array_unique($mailDetails)),
    'telegram' => $telegramStatus,
    'telegram_seconds' => $telegramSeconds,
]);

// --- Telegram (after the response: the hosting reaches it with long delays) ---
if ($telegramConfigured && !$waitForTelegram) {
    $sendTelegram();
}
