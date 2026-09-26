<?php

declare(strict_types=1);

/**
 * The saved version of the whole resume, both languages (admin only). There is only one: saving replaces it.
 *   GET                         → {"latest": "2026-09-27 14:05:00" | null}
 *   POST {"action":"save"}      → remembers the resume as it is now, instead of the version saved before
 *   POST {"action":"restore"}   → throws away the edits made since, the version itself stays
 *
 * A version is a copy of every row of the resume tables, so it brings back everything the editor can change:
 * texts, order, hidden sections, photos.
 */

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

require __DIR__ . '/lib/auth.php';
require __DIR__ . '/lib/db.php';

// Everything the editor changes. resume.php creates them on the first visit of the site.
const RESUME_TABLES = [
    'resume_profile',
    'resume_experience',
    'resume_technologies',
    'resume_education',
    'resume_certificates',
    'resume_certificate_photos',
    'resume_skills',
];

function respond(int $status, array $body): void
{
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_UNICODE);
    exit;
}

$configFile = __DIR__ . '/config.php';
$config = is_file($configFile) ? require $configFile : [];
if (!isAdmin($config)) {
    respond(401, ['ok' => false, 'error' => 'not_logged_in']);
}
if (empty($config['db_name'])) {
    respond(503, ['ok' => false, 'error' => 'not_configured']);
}

try {
    $pdo = connectDb($config);
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS resume_versions (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            data LONGTEXT NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
    );
    $latest = $pdo->query('SELECT id, created_at, data FROM resume_versions ORDER BY id DESC LIMIT 1')->fetch() ?: null;

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        respond(200, ['latest' => $latest['created_at'] ?? null]);
    }
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        header('Allow: GET, POST');
        respond(405, ['ok' => false, 'error' => 'method_not_allowed']);
    }

    $input = json_decode((string) file_get_contents('php://input'), true);
    $action = is_array($input) ? (string) ($input['action'] ?? '') : '';

    if ($action === 'save') {
        $data = [];
        foreach (RESUME_TABLES as $table) {
            $data[$table] = $pdo->query('SELECT * FROM ' . $table)->fetchAll();
        }
        // Slashes stay as they are, so lib/media.php can find the photos a version points at.
        $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        $pdo->beginTransaction();
        $pdo->exec('DELETE FROM resume_versions');
        $pdo->prepare('INSERT INTO resume_versions (data) VALUES (?)')->execute([$json]);
        $pdo->commit();

        // Photos kept only for the version saved before aren't needed any more: the new one is the resume as it is.
        foreach (glob(dirname(__DIR__) . '/media/*') ?: [] as $file) {
            $isPhoto = preg_match('/\.(jpg|png|webp)$/', $file) === 1;
            if ($isPhoto && strpos($json, '"/media/' . basename($file) . '"') === false) {
                @unlink($file);
            }
        }

        $created = $pdo->query('SELECT created_at FROM resume_versions')->fetchColumn();
        respond(200, ['ok' => true, 'latest' => $created]);
    }

    if ($action === 'restore') {
        if ($latest === null) {
            respond(400, ['ok' => false, 'error' => 'no_versions']);
        }
        $data = json_decode($latest['data'], true);
        $pdo->beginTransaction();
        foreach (RESUME_TABLES as $table) {
            // Columns added after the version was saved keep their defaults.
            $columns = array_column($pdo->query('SHOW COLUMNS FROM ' . $table)->fetchAll(), 'Field');
            $pdo->exec('DELETE FROM ' . $table);
            foreach ($data[$table] ?? [] as $row) {
                $row = array_intersect_key($row, array_flip($columns));
                $pdo->prepare(
                    'INSERT INTO ' . $table . ' (' . implode(', ', array_keys($row)) . ')
                     VALUES (' . implode(', ', array_fill(0, count($row), '?')) . ')'
                )->execute(array_values($row));
            }
        }
        $pdo->commit();
        respond(200, ['ok' => true, 'latest' => $latest['created_at']]);
    }

    respond(400, ['ok' => false, 'error' => 'unknown_action']);
} catch (Throwable $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log('versions.php: ' . $e->getMessage());
    respond(500, ['ok' => false, 'error' => 'server_error']);
}
