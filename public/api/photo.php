<?php

declare(strict_types=1);

/**
 * Photos from the editor (admin only); the body is the image itself (the editor sends a JPEG it has scaled down).
 *   POST                                        → the profile photo, for both languages; the previous one is removed
 *   POST ?for=certificate&id=cert-…&lang=ru     → one more scan of that certificate
 *   POST ?delete=certificate  {id, src}         → removes a scan of a certificate
 *
 * Files go to /media next to the site, under a new name each time so browsers don't show a cached one.
 */

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

require __DIR__ . '/lib/auth.php';
require __DIR__ . '/lib/db.php';
require __DIR__ . '/lib/media.php';

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const PHOTO_TYPES = [IMAGETYPE_JPEG => 'jpg', IMAGETYPE_PNG => 'png', IMAGETYPE_WEBP => 'webp'];

function respond(int $status, array $body): void
{
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_UNICODE);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: POST');
    respond(405, ['ok' => false, 'error' => 'method_not_allowed']);
}

$configFile = __DIR__ . '/config.php';
$config = is_file($configFile) ? require $configFile : [];
if (!isAdmin($config)) {
    respond(401, ['ok' => false, 'error' => 'not_logged_in']);
}
if (empty($config['db_name'])) {
    respond(503, ['ok' => false, 'error' => 'not_configured']);
}

if (($_GET['delete'] ?? '') === 'certificate') {
    $input = json_decode((string) file_get_contents('php://input'), true);
    $certificateId = (string) ($input['id'] ?? '');
    $src = (string) ($input['src'] ?? '');
    try {
        $pdo = connectDb($config);
        $stmt = $pdo->prepare('DELETE FROM resume_certificate_photos WHERE certificate_id = ? AND src = ?');
        $stmt->execute([$certificateId, $src]);
    } catch (Throwable $e) {
        error_log('photo.php: ' . $e->getMessage());
        respond(500, ['ok' => false, 'error' => 'server_error']);
    }
    if ($stmt->rowCount() === 0) {
        respond(400, ['ok' => false, 'error' => 'invalid_field', 'field' => 'src']);
    }
    // Scans built into the site stay in the build; only uploaded files are deleted.
    deleteMediaFile($pdo, $src);
    respond(200, ['ok' => true]);
}

$forCertificate = ($_GET['for'] ?? '') === 'certificate';
$certificateId = (string) ($_GET['id'] ?? '');
$lang = (string) ($_GET['lang'] ?? '');
if ($forCertificate && (!preg_match('/^[\w-]{1,64}$/', $certificateId) || !in_array($lang, ['ru', 'en'], true))) {
    respond(400, ['ok' => false, 'error' => 'invalid_field', 'field' => 'id']);
}

$image = (string) file_get_contents('php://input', false, null, 0, MAX_PHOTO_BYTES + 1);
if ($image === '' || strlen($image) > MAX_PHOTO_BYTES) {
    respond(400, ['ok' => false, 'error' => 'invalid_field', 'field' => 'photo']);
}
// The type is read from the file itself, never from what the browser claims.
$info = @getimagesizefromstring($image);
if ($info === false || !isset(PHOTO_TYPES[$info[2]])) {
    respond(400, ['ok' => false, 'error' => 'invalid_field', 'field' => 'photo']);
}

$dir = dirname(__DIR__) . '/media';
if (!is_dir($dir) && !mkdir($dir, 0755, true)) {
    error_log('photo.php: cannot create ' . $dir);
    respond(500, ['ok' => false, 'error' => 'server_error']);
}
// Only pictures live here: nothing in the folder may run as a script.
if (!is_file($dir . '/.htaccess')) {
    file_put_contents($dir . '/.htaccess', "<FilesMatch \"\\.(php\\d?|phtml|phar|cgi|pl|py)$\">\n  Require all denied\n</FilesMatch>\n");
}

$name = ($forCertificate ? 'cert-' : 'profile-') . date('YmdHis') . '-' . bin2hex(random_bytes(3)) . '.' . PHOTO_TYPES[$info[2]];
if (file_put_contents($dir . '/' . $name, $image) === false) {
    error_log('photo.php: cannot write ' . $name);
    respond(500, ['ok' => false, 'error' => 'server_error']);
}

if ($forCertificate) {
    try {
        $pdo = connectDb($config);
        $stmt = $pdo->prepare('SELECT COUNT(*) FROM resume_certificates WHERE id = ?');
        $stmt->execute([$certificateId]);
        if ((int) $stmt->fetchColumn() === 0) {
            @unlink($dir . '/' . $name);
            respond(400, ['ok' => false, 'error' => 'invalid_field', 'field' => 'id']);
        }
        $next = $pdo->prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 FROM resume_certificate_photos WHERE certificate_id = ?');
        $next->execute([$certificateId]);
        $pdo->prepare(
            'INSERT INTO resume_certificate_photos (certificate_id, sort_order, src, lang, is_official) VALUES (?, ?, ?, ?, 0)'
        )->execute([$certificateId, (int) $next->fetchColumn(), '/media/' . $name, $lang]);
    } catch (Throwable $e) {
        error_log('photo.php: ' . $e->getMessage());
        @unlink($dir . '/' . $name);
        respond(500, ['ok' => false, 'error' => 'server_error']);
    }
    respond(200, ['ok' => true, 'photo' => '/media/' . $name]);
}

try {
    $pdo = connectDb($config);
    // Created by resume.php as well; added here too in case the editor uploads before the site was opened.
    if ($pdo->query("SHOW COLUMNS FROM resume_profile LIKE 'photo'")->fetch() === false) {
        $pdo->exec('ALTER TABLE resume_profile ADD photo VARCHAR(300) NULL');
    }
    $pdo->prepare('UPDATE resume_profile SET photo = ?')->execute(['/media/' . $name]);
} catch (Throwable $e) {
    error_log('photo.php: ' . $e->getMessage());
    @unlink($dir . '/' . $name);
    respond(500, ['ok' => false, 'error' => 'server_error']);
}

// The old photos aren't referenced any more (unless a saved version still has them).
foreach (glob($dir . '/profile-*') ?: [] as $old) {
    if (basename($old) !== $name) {
        deleteMediaFile($pdo, '/media/' . basename($old));
    }
}

respond(200, ['ok' => true, 'photo' => '/media/' . $name]);
