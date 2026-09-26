<?php

declare(strict_types=1);

/**
 * Resume content endpoint: GET ?lang=ru|en returns the profile, experience, education,
 * certificates and skills for that language from MySQL.
 *
 * The tables are created on the first request and filled from seed/*.json while they're empty,
 * so after that the content is edited right in the database (e.g. phpMyAdmin), without a redeploy.
 */

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

const LANGUAGES = ['ru', 'en'];

// ?debug=db also reports fatal errors that no catch sees, instead of an empty response.
if (($_GET['debug'] ?? '') === 'db') {
    register_shutdown_function(static function (): void {
        $error = error_get_last();
        if ($error !== null && in_array($error['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR], true)) {
            echo json_encode(['ok' => false, 'error' => 'fatal', 'details' => $error['message'], 'line' => $error['line']]);
        }
    });
}

function respond(int $status, array $body): void
{
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_UNICODE);
    exit;
}

// Lists are stored as JSON text and keys stay short, so old MySQL/MariaDB on shared hosting accept the schema too.
function createTables(PDO $pdo): void
{
    $tables = [
        'resume_profile (
            lang CHAR(2) NOT NULL PRIMARY KEY,
            full_name VARCHAR(200) NOT NULL,
            birth_date DATE NOT NULL,
            gender VARCHAR(50) NOT NULL,
            gender_code VARCHAR(10) NOT NULL,
            phones TEXT NOT NULL,
            telegram TEXT NOT NULL,
            email TEXT NOT NULL
        )',
        'resume_experience (
            id VARCHAR(64) NOT NULL,
            lang CHAR(2) NOT NULL,
            sort_order INT NOT NULL DEFAULT 0,
            company VARCHAR(200) NOT NULL,
            url VARCHAR(500) NULL,
            role VARCHAR(200) NOT NULL,
            location VARCHAR(200) NULL,
            start_date CHAR(7) NOT NULL,
            end_date CHAR(7) NULL,
            web TINYINT(1) NULL,
            highlights TEXT NOT NULL,
            PRIMARY KEY (id, lang)
        )',
        // Technology tags don\'t depend on the language, so they are stored once per experience id.
        'resume_technologies (
            experience_id VARCHAR(64) NOT NULL,
            sort_order INT NOT NULL DEFAULT 0,
            name VARCHAR(100) NOT NULL,
            PRIMARY KEY (experience_id, sort_order)
        )',
        'resume_education (
            id VARCHAR(64) NOT NULL,
            lang CHAR(2) NOT NULL,
            sort_order INT NOT NULL DEFAULT 0,
            institution VARCHAR(300) NOT NULL,
            degree VARCHAR(200) NOT NULL,
            level VARCHAR(100) NULL,
            field VARCHAR(300) NULL,
            start_date CHAR(7) NOT NULL,
            end_date CHAR(7) NULL,
            description VARCHAR(500) NULL,
            url VARCHAR(500) NULL,
            PRIMARY KEY (id, lang)
        )',
        'resume_certificates (
            id VARCHAR(64) NOT NULL,
            lang CHAR(2) NOT NULL,
            sort_order INT NOT NULL DEFAULT 0,
            name VARCHAR(300) NOT NULL,
            issuer VARCHAR(300) NOT NULL,
            issuer_url VARCHAR(500) NULL,
            date CHAR(4) NOT NULL,
            url VARCHAR(500) NULL,
            PRIMARY KEY (id, lang)
        )',
        'resume_skills (
            lang CHAR(2) NOT NULL,
            sort_order INT NOT NULL DEFAULT 0,
            name VARCHAR(200) NOT NULL,
            PRIMARY KEY (lang, sort_order)
        )',
    ];
    foreach ($tables as $table) {
        $pdo->exec('CREATE TABLE IF NOT EXISTS ' . $table . ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
    }
}

function readSeed(string $path): array
{
    $data = json_decode((string) file_get_contents(__DIR__ . '/seed/' . $path), true);
    if (!is_array($data)) {
        throw new RuntimeException('Bad seed file: ' . $path);
    }
    return $data;
}

/** Fills the tables from seed/*.json, but only on the very first run: edits in the DB are never overwritten. */
function seedIfEmpty(PDO $pdo): void
{
    if ((int) $pdo->query('SELECT COUNT(*) FROM resume_profile')->fetchColumn() > 0) {
        return;
    }

    $json = static fn (array $value): string => json_encode($value, JSON_UNESCAPED_UNICODE);
    $pdo->beginTransaction();
    try {
        foreach (LANGUAGES as $lang) {
            $profile = readSeed($lang . '/profile.json');
            $pdo->prepare('INSERT INTO resume_profile VALUES (?, ?, ?, ?, ?, ?, ?, ?)')->execute([
                $lang, $profile['fullName'], $profile['birthDate'], $profile['gender'], $profile['genderCode'],
                $json($profile['phones']), $json($profile['telegram']), $json($profile['email']),
            ]);

            $stmt = $pdo->prepare(
                'INSERT INTO resume_experience
                    (id, lang, sort_order, company, url, role, location, start_date, end_date, web, highlights)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
            );
            foreach (readSeed($lang . '/experience.json') as $i => $item) {
                $stmt->execute([
                    $item['id'], $lang, $i, $item['company'], $item['url'] ?? null, $item['role'],
                    $item['location'] ?? null, $item['startDate'], $item['endDate'],
                    isset($item['web']) ? (int) $item['web'] : null, $json($item['highlights']),
                ]);
            }

            $stmt = $pdo->prepare(
                'INSERT INTO resume_education
                    (id, lang, sort_order, institution, degree, level, field, start_date, end_date, description, url)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
            );
            foreach (readSeed($lang . '/education.json') as $i => $item) {
                $stmt->execute([
                    $item['id'], $lang, $i, $item['institution'], $item['degree'], $item['level'] ?? null,
                    $item['field'] ?? null, $item['startDate'], $item['endDate'], $item['description'] ?? null,
                    $item['url'] ?? null,
                ]);
            }

            $stmt = $pdo->prepare(
                'INSERT INTO resume_certificates (id, lang, sort_order, name, issuer, issuer_url, date, url)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
            );
            foreach (readSeed($lang . '/certificates.json') as $i => $item) {
                $stmt->execute([
                    $item['id'], $lang, $i, $item['name'], $item['issuer'], $item['issuerUrl'] ?? null,
                    $item['date'], $item['url'] ?? null,
                ]);
            }

            $stmt = $pdo->prepare('INSERT INTO resume_skills (lang, sort_order, name) VALUES (?, ?, ?)');
            foreach (readSeed($lang . '/skills.json') as $i => $name) {
                $stmt->execute([$lang, $i, $name]);
            }
        }

        $stmt = $pdo->prepare('INSERT INTO resume_technologies (experience_id, sort_order, name) VALUES (?, ?, ?)');
        foreach (readSeed('technologies.json') as $experienceId => $names) {
            foreach ($names as $i => $name) {
                $stmt->execute([$experienceId, $i, $name]);
            }
        }

        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }
}

/** Drops nulls, so the JSON matches the optional fields the frontend types expect. */
function withoutNulls(array $item): array
{
    return array_filter($item, static fn ($value) => $value !== null);
}

function loadResume(PDO $pdo, string $lang): array
{
    $select = static function (string $sql) use ($pdo, $lang): array {
        $stmt = $pdo->prepare($sql);
        $stmt->execute([$lang]);
        return $stmt->fetchAll();
    };
    $decode = static fn (string $value): array => json_decode($value, true) ?: [];

    $profile = $select('SELECT * FROM resume_profile WHERE lang = ?')[0] ?? null;
    if ($profile === null) {
        return [];
    }

    $technologies = [];
    foreach ($pdo->query('SELECT experience_id, name FROM resume_technologies ORDER BY sort_order') as $row) {
        $technologies[$row['experience_id']][] = $row['name'];
    }

    return [
        'profile' => [
            'fullName' => $profile['full_name'],
            'birthDate' => $profile['birth_date'],
            'gender' => $profile['gender'],
            'genderCode' => $profile['gender_code'],
            'phones' => $decode($profile['phones']),
            'telegram' => $decode($profile['telegram']),
            'email' => $decode($profile['email']),
        ],
        'experience' => array_map(static fn (array $row): array => withoutNulls([
            'id' => $row['id'],
            'company' => $row['company'],
            'url' => $row['url'],
            'role' => $row['role'],
            'location' => $row['location'],
            'startDate' => $row['start_date'],
            'endDate' => $row['end_date'],
            'highlights' => $decode($row['highlights']),
            'technologies' => $technologies[$row['id']] ?? null,
            'web' => $row['web'] === null ? null : (bool) $row['web'],
        ]) + ['endDate' => null], $select('SELECT * FROM resume_experience WHERE lang = ? ORDER BY sort_order')),
        'education' => array_map(static fn (array $row): array => withoutNulls([
            'id' => $row['id'],
            'institution' => $row['institution'],
            'degree' => $row['degree'],
            'level' => $row['level'],
            'field' => $row['field'],
            'startDate' => $row['start_date'],
            'endDate' => $row['end_date'],
            'description' => $row['description'],
            'url' => $row['url'],
        ]) + ['endDate' => null], $select('SELECT * FROM resume_education WHERE lang = ? ORDER BY sort_order')),
        'certificates' => array_map(static fn (array $row): array => withoutNulls([
            'id' => $row['id'],
            'name' => $row['name'],
            'issuer' => $row['issuer'],
            'issuerUrl' => $row['issuer_url'],
            'date' => $row['date'],
            'url' => $row['url'],
        ]), $select('SELECT * FROM resume_certificates WHERE lang = ? ORDER BY sort_order')),
        'skills' => array_column($select('SELECT name FROM resume_skills WHERE lang = ? ORDER BY sort_order'), 'name'),
    ];
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    header('Allow: GET');
    respond(405, ['ok' => false, 'error' => 'method_not_allowed']);
}

$lang = (string) ($_GET['lang'] ?? 'ru');
if (!in_array($lang, LANGUAGES, true)) {
    respond(400, ['ok' => false, 'error' => 'unknown_language']);
}

$configFile = __DIR__ . '/config.php';
$config = is_file($configFile) ? require $configFile : [];
if (empty($config['db_name'])) {
    error_log('resume.php: database is not configured');
    respond(503, ['ok' => false, 'error' => 'not_configured']);
}

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
    // The hosting ignores the charset in the DSN; without this Cyrillic is saved and read back as garbage.
    $pdo->exec('SET NAMES utf8mb4');
    createTables($pdo);
    seedIfEmpty($pdo);
    $resume = loadResume($pdo, $lang);
} catch (Throwable $e) {
    error_log('resume.php: ' . $e->getMessage());
    // ?debug=db shows the database error itself, to diagnose the hosting from the browser.
    $details = ($_GET['debug'] ?? '') === 'db' ? ['details' => $e->getMessage()] : [];
    respond(500, ['ok' => false, 'error' => 'server_error'] + $details);
}

if ($resume === []) {
    respond(404, ['ok' => false, 'error' => 'not_found']);
}

$body = json_encode($resume, JSON_UNESCAPED_UNICODE);
if ($body === false) {
    error_log('resume.php: json_encode failed: ' . json_last_error_msg());
    $details = [];
    if (($_GET['debug'] ?? '') === 'db') {
        // Which sections break the encoding, and how the connection is set up.
        $details['details'] = json_last_error_msg();
        $details['broken'] = array_keys(array_filter($resume, static fn ($section) => json_encode($section) === false));
        $details['mysql'] = $pdo->query('SELECT VERSION()')->fetchColumn();
        $details['charset'] = $pdo->query("SHOW VARIABLES LIKE 'character_set_%'")->fetchAll(PDO::FETCH_KEY_PAIR);
    }
    respond(500, ['ok' => false, 'error' => 'encode_failed'] + $details);
}

// Short cache: DB edits show up within a few minutes without hammering MySQL on every visit.
header('Cache-Control: public, max-age=300');
echo $body;
