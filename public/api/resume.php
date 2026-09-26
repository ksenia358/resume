<?php

declare(strict_types=1);

/**
 * Resume content endpoint: GET ?lang=ru|en returns the profile, experience, education,
 * certificates and skills for that language from MySQL; POST saves one block from the editor (admin only).
 *
 * The tables are created on the first request and filled from seed/*.json (copied from src/shared/data/content
 * by the build) while they're empty,
 * so after that the content is edited right in the database (e.g. phpMyAdmin), without a redeploy.
 */

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

require __DIR__ . '/lib/auth.php';
require __DIR__ . '/lib/db.php';
require __DIR__ . '/lib/media.php';

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
            role VARCHAR(200) NOT NULL DEFAULT \'\',
            tagline VARCHAR(300) NOT NULL DEFAULT \'\',
            birth_date DATE NOT NULL,
            gender VARCHAR(50) NOT NULL,
            gender_code VARCHAR(10) NOT NULL,
            phones TEXT NOT NULL,
            phones_together TINYINT(1) NOT NULL DEFAULT 0,
            telegram TEXT NOT NULL,
            telegram_together TINYINT(1) NOT NULL DEFAULT 1,
            email TEXT NOT NULL,
            email_together TINYINT(1) NOT NULL DEFAULT 1,
            show_tech_match TINYINT(1) NOT NULL DEFAULT 1,
            show_write TINYINT(1) NOT NULL DEFAULT 1,
            contacts_order TEXT NULL,
            contacts_order_mobile TEXT NULL,
            hidden_sections TEXT NULL,
            photo VARCHAR(300) NULL
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

    // Certificate scans came into the database later than the rest: a database made before that gets the table
    // filled with the scans built into the site, and a new one gets them the same way.
    if ($pdo->query("SHOW TABLES LIKE 'resume_certificate_photos'")->fetch() === false) {
        $pdo->exec(
            'CREATE TABLE resume_certificate_photos (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                certificate_id VARCHAR(64) NOT NULL,
                sort_order INT NOT NULL DEFAULT 0,
                src VARCHAR(300) NOT NULL,
                lang CHAR(2) NOT NULL,
                is_official TINYINT(1) NOT NULL DEFAULT 0,
                KEY idx_certificate (certificate_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
        );
        $stmt = $pdo->prepare(
            'INSERT INTO resume_certificate_photos (certificate_id, sort_order, src, lang, is_official) VALUES (?, ?, ?, ?, ?)'
        );
        foreach (readSeed('certificatePhotos.json') as $certificateId => $photos) {
            foreach ($photos as $i => $photo) {
                $stmt->execute([$certificateId, $i, $photo['src'], $photo['lang'], empty($photo['isOfficialDocument']) ? 0 : 1]);
            }
        }
    }

    // The profession and its tagline moved into the profile later: databases made before that get the columns,
    // filled from the seed so the header isn't empty.
    if ($pdo->query("SHOW COLUMNS FROM resume_profile LIKE 'role'")->fetch() === false) {
        $pdo->exec("ALTER TABLE resume_profile ADD role VARCHAR(200) NOT NULL DEFAULT '' AFTER full_name,
            ADD tagline VARCHAR(300) NOT NULL DEFAULT '' AFTER role");
        $stmt = $pdo->prepare('UPDATE resume_profile SET role = ?, tagline = ? WHERE lang = ?');
        foreach (LANGUAGES as $lang) {
            $profile = readSeed($lang . '/profile.json');
            $stmt->execute([$profile['role'], $profile['tagline'] ?? '', $lang]);
        }
    }
    // Display switches of the contacts block, added over time: whether each contact list is shown in one column
    // (phones are split by default, the rest together), and whether the "tech match" and "write" links are shown.
    $switches = [
        'phones_together' => 'DEFAULT 0 AFTER phones',
        'telegram_together' => 'DEFAULT 1 AFTER telegram',
        'email_together' => 'DEFAULT 1 AFTER email',
        'show_tech_match' => 'DEFAULT 1',
        'show_write' => 'DEFAULT 1',
    ];
    foreach ($switches as $column => $definition) {
        if ($pdo->query("SHOW COLUMNS FROM resume_profile LIKE '{$column}'")->fetch() === false) {
            $pdo->exec("ALTER TABLE resume_profile ADD {$column} TINYINT(1) NOT NULL {$definition}");
        }
    }
    // The order of the contact cells, set by dragging them in the editor (phones have their own); NULL is the default.
    // Likewise the sections turned off with the eye.
    foreach (['contacts_order', 'contacts_order_mobile', 'hidden_sections'] as $column) {
        if ($pdo->query("SHOW COLUMNS FROM resume_profile LIKE '{$column}'")->fetch() === false) {
            $pdo->exec("ALTER TABLE resume_profile ADD {$column} TEXT NULL");
        }
    }
    // An uploaded photo (photo.php); NULL shows the one built into the site.
    if ($pdo->query("SHOW COLUMNS FROM resume_profile LIKE 'photo'")->fetch() === false) {
        $pdo->exec('ALTER TABLE resume_profile ADD photo VARCHAR(300) NULL');
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
            $pdo->prepare(
                'INSERT INTO resume_profile
                    (lang, full_name, role, tagline, birth_date, gender, gender_code,
                     phones, phones_together, telegram, telegram_together, email, email_together,
                     show_tech_match, show_write, contacts_order, contacts_order_mobile, hidden_sections)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
            )->execute([
                $lang, $profile['fullName'], $profile['role'], $profile['tagline'] ?? '', $profile['birthDate'],
                $profile['gender'], $profile['genderCode'],
                $json($profile['phones']), (int) ($profile['phonesTogether'] ?? false),
                $json($profile['telegram']), (int) ($profile['telegramTogether'] ?? true),
                $json($profile['email']), (int) ($profile['emailTogether'] ?? true),
                (int) ($profile['showTechMatch'] ?? true), (int) ($profile['showWrite'] ?? true),
                isset($profile['contactsOrder']) ? $json($profile['contactsOrder']) : null,
                isset($profile['contactsOrderMobile']) ? $json($profile['contactsOrderMobile']) : null,
                isset($profile['hiddenSections']) ? $json($profile['hiddenSections']) : null,
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

    $photos = [];
    foreach ($pdo->query('SELECT * FROM resume_certificate_photos ORDER BY sort_order, id') as $row) {
        $photos[$row['certificate_id']][] = ['src' => $row['src'], 'lang' => $row['lang']]
            + ($row['is_official'] ? ['isOfficialDocument' => true] : []);
    }

    return [
        // withoutNulls: the contacts order is left out while it's the default one, like in the JSON.
        'profile' => withoutNulls([
            'fullName' => $profile['full_name'],
            'role' => $profile['role'],
            'tagline' => $profile['tagline'],
            'phonesTogether' => (bool) $profile['phones_together'],
            'emailTogether' => (bool) $profile['email_together'],
            'telegramTogether' => (bool) $profile['telegram_together'],
            'showTechMatch' => (bool) $profile['show_tech_match'],
            'showWrite' => (bool) $profile['show_write'],
            'contactsOrder' => $profile['contacts_order'] === null ? null : $decode($profile['contacts_order']),
            'contactsOrderMobile' => $profile['contacts_order_mobile'] === null ? null : $decode($profile['contacts_order_mobile']),
            'hiddenSections' => $profile['hidden_sections'] === null ? null : $decode($profile['hidden_sections']),
            'photo' => $profile['photo'],
            'birthDate' => $profile['birth_date'],
            'gender' => $profile['gender'],
            'genderCode' => $profile['gender_code'],
            'phones' => $decode($profile['phones']),
            'telegram' => $decode($profile['telegram']),
            'email' => $decode($profile['email']),
        ]),
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
            'photos' => $photos[$row['id']] ?? null,
        ]), $select('SELECT * FROM resume_certificates WHERE lang = ? ORDER BY sort_order')),
        'skills' => array_column($select('SELECT name FROM resume_skills WHERE lang = ? ORDER BY sort_order'), 'name'),
    ];
}


/** Thrown for a save request with a missing or malformed field; the message names the field. */
final class InvalidInput extends RuntimeException
{
}

function text(array $data, string $key, int $max, bool $required = true, ?string $pattern = null): ?string
{
    $value = trim((string) ($data[$key] ?? ''));
    if ($value === '') {
        if ($required) {
            throw new InvalidInput($key);
        }
        return null;
    }
    $length = function_exists('mb_strlen') ? mb_strlen($value, 'UTF-8') : strlen($value);
    if ($length > $max || ($pattern !== null && !preg_match($pattern, $value))) {
        throw new InvalidInput($key);
    }
    return $value;
}

function textList(array $data, string $key, int $maxItem, bool $required = false): array
{
    $value = $data[$key] ?? [];
    if (!is_array($value)) {
        throw new InvalidInput($key);
    }
    $items = [];
    foreach ($value as $item) {
        $item = text(['v' => $item], 'v', $maxItem, false);
        if ($item !== null) {
            $items[] = $item;
        }
    }
    if ($required && $items === []) {
        throw new InvalidInput($key);
    }
    return $items;
}

const SECTIONS = ['experience', 'education', 'certificates', 'skills', 'contact'];

function sectionList(array $data): array
{
    $sections = textList($data, 'hiddenSections', 20);
    if (array_diff($sections, SECTIONS) !== []) {
        throw new InvalidInput('hiddenSections');
    }
    return array_values(array_unique($sections));
}

const MONTH = '/^\d{4}-(0[1-9]|1[0-2])$/';
const ITEM_TABLES = ['experience' => 'resume_experience', 'education' => 'resume_education', 'certificates' => 'resume_certificates'];
const ITEM_ID_PREFIXES = ['experience' => 'exp', 'education' => 'edu', 'certificates' => 'cert'];
const URL = '#^https?://\S+$#';

/** Saves one block: the profile or skills of a language, or one item of experience, education or certificates (a new one without an id). */
function saveSection(PDO $pdo, string $lang, string $section, ?string $id, $data): void
{
    $json = static fn (array $value): string => json_encode($value, JSON_UNESCAPED_UNICODE);

    if ($section === 'skills') {
        $skills = textList(['skills' => $data], 'skills', 200, true);
        $pdo->beginTransaction();
        $pdo->prepare('DELETE FROM resume_skills WHERE lang = ?')->execute([$lang]);
        $stmt = $pdo->prepare('INSERT INTO resume_skills (lang, sort_order, name) VALUES (?, ?, ?)');
        foreach (array_values(array_unique($skills)) as $i => $name) {
            $stmt->execute([$lang, $i, $name]);
        }
        $pdo->commit();
        return;
    }

    if (!is_array($data)) {
        throw new InvalidInput('data');
    }

    if ($section === 'profile') {
        $pdo->prepare(
            'UPDATE resume_profile SET full_name = ?, role = ?, tagline = ?, birth_date = ?, gender = ?, gender_code = ?,
                phones = ?, phones_together = ?, telegram = ?, telegram_together = ?, email = ?, email_together = ?,
                show_tech_match = ?, show_write = ?, contacts_order = ?, contacts_order_mobile = ?, hidden_sections = ?
                WHERE lang = ?'
        )->execute([
            text($data, 'fullName', 200),
            text($data, 'role', 200),
            text($data, 'tagline', 300, false) ?? '',
            text($data, 'birthDate', 10, true, '/^\d{4}-\d{2}-\d{2}$/'),
            text($data, 'gender', 50, false) ?? '',
            text($data, 'genderCode', 10, true, '/^(female|male|none)$/'),
            $json(textList($data, 'phones', 50)),
            empty($data['phonesTogether']) ? 0 : 1,
            $json(textList($data, 'telegram', 100)),
            empty($data['telegramTogether']) ? 0 : 1,
            $json(textList($data, 'email', 254)),
            empty($data['emailTogether']) ? 0 : 1,
            empty($data['showTechMatch']) ? 0 : 1,
            empty($data['showWrite']) ? 0 : 1,
            isset($data['contactsOrder']) ? $json(textList($data, 'contactsOrder', 200)) : null,
            isset($data['contactsOrderMobile']) ? $json(textList($data, 'contactsOrderMobile', 200)) : null,
            isset($data['hiddenSections']) ? $json(sectionList($data)) : null,
            $lang,
        ]);
        return;
    }

    // The columns of an item, checked; saved as they are into its row.
    if ($section === 'experience') {
        $columns = [
            'company' => text($data, 'company', 200),
            'url' => text($data, 'url', 500, false, URL),
            'role' => text($data, 'role', 200),
            'location' => text($data, 'location', 200, false),
            'start_date' => text($data, 'startDate', 7, true, MONTH),
            'end_date' => text($data, 'endDate', 7, false, MONTH),
            'web' => empty($data['web']) ? 0 : 1,
            'highlights' => $json(textList($data, 'highlights', 2000, true)),
        ];
        $technologies = array_values(array_unique(textList($data, 'technologies', 100)));
    } elseif ($section === 'education') {
        $columns = [
            'institution' => text($data, 'institution', 300),
            'degree' => text($data, 'degree', 200),
            'level' => text($data, 'level', 100, false),
            'field' => text($data, 'field', 300, false),
            'start_date' => text($data, 'startDate', 7, true, MONTH),
            'end_date' => text($data, 'endDate', 7, false, MONTH),
            'description' => text($data, 'description', 500, false),
            'url' => text($data, 'url', 500, false, URL),
        ];
    } elseif ($section === 'certificates') {
        $columns = [
            'name' => text($data, 'name', 300),
            'issuer' => text($data, 'issuer', 300),
            'issuer_url' => text($data, 'issuerUrl', 500, false, URL),
            'date' => text($data, 'date', 4, true, '/^\d{4}$/'),
            'url' => text($data, 'url', 500, false, URL),
        ];
    } else {
        throw new InvalidInput('section');
    }
    $table = ITEM_TABLES[$section];

    $pdo->beginTransaction();
    if ($id === null || $id === '') {
        // A new item goes to the top of the list, in both languages: the other one is translated afterwards.
        $id = ITEM_ID_PREFIXES[$section] . '-' . base_convert((string) time(), 10, 36) . bin2hex(random_bytes(2));
        $first = (int) $pdo->query('SELECT COALESCE(MIN(sort_order), 0) FROM ' . $table)->fetchColumn();
        $names = array_merge(['id', 'lang', 'sort_order'], array_keys($columns));
        $stmt = $pdo->prepare(
            'INSERT INTO ' . $table . ' (' . implode(', ', $names) . ') VALUES (' . implode(', ', array_fill(0, count($names), '?')) . ')'
        );
        foreach (LANGUAGES as $itemLang) {
            $stmt->execute(array_merge([$id, $itemLang, $first - 1], array_values($columns)));
        }
    } else {
        requireItem($pdo, $table, $id, $lang);
        $assignments = implode(', ', array_map(static fn (string $name): string => $name . ' = ?', array_keys($columns)));
        $pdo->prepare('UPDATE ' . $table . ' SET ' . $assignments . ' WHERE id = ? AND lang = ?')
            ->execute(array_merge(array_values($columns), [$id, $lang]));
    }

    if ($section === 'experience') {
        // Tags are shared by both languages of the item.
        $pdo->prepare('DELETE FROM resume_technologies WHERE experience_id = ?')->execute([$id]);
        $stmt = $pdo->prepare('INSERT INTO resume_technologies (experience_id, sort_order, name) VALUES (?, ?, ?)');
        foreach ($technologies as $i => $name) {
            $stmt->execute([$id, $i, $name]);
        }
    }
    $pdo->commit();
}

function requireItem(PDO $pdo, string $table, string $id, string $lang): void
{
    $stmt = $pdo->prepare('SELECT COUNT(*) FROM ' . $table . ' WHERE id = ? AND lang = ?');
    $stmt->execute([$id, $lang]);
    if ((int) $stmt->fetchColumn() === 0) {
        throw new InvalidInput('id');
    }
}

/** Removes an item from both languages. */
function deleteItem(PDO $pdo, string $lang, string $section, ?string $id): void
{
    if (!isset(ITEM_TABLES[$section]) || $id === null || $id === '') {
        throw new InvalidInput('section');
    }
    requireItem($pdo, ITEM_TABLES[$section], $id, $lang);
    $pdo->beginTransaction();
    $pdo->prepare('DELETE FROM ' . ITEM_TABLES[$section] . ' WHERE id = ?')->execute([$id]);
    if ($section === 'experience') {
        $pdo->prepare('DELETE FROM resume_technologies WHERE experience_id = ?')->execute([$id]);
    }
    if ($section === 'certificates') {
        $stmt = $pdo->prepare('SELECT src FROM resume_certificate_photos WHERE certificate_id = ?');
        $stmt->execute([$id]);
        $uploaded = array_filter($stmt->fetchAll(PDO::FETCH_COLUMN), static fn (string $src): bool => strpos($src, '/media/') === 0);
        $pdo->prepare('DELETE FROM resume_certificate_photos WHERE certificate_id = ?')->execute([$id]);
    }
    $pdo->commit();
    // Scans uploaded for it aren't used anywhere else (unless a saved version still has them).
    foreach ($uploaded ?? [] as $src) {
        deleteMediaFile($pdo, $src);
    }
}

$method = $_SERVER['REQUEST_METHOD'];
if ($method !== 'GET' && $method !== 'POST') {
    header('Allow: GET, POST');
    respond(405, ['ok' => false, 'error' => 'method_not_allowed']);
}

// POST {lang, section, id?, data} saves one block from the editor, {lang, section, id, delete: true} removes an item (admin only).
$input = $method === 'POST' ? json_decode((string) file_get_contents('php://input'), true) : null;
if ($method === 'POST' && !is_array($input)) {
    respond(400, ['ok' => false, 'error' => 'invalid_json']);
}
$lang = (string) ($method === 'POST' ? ($input['lang'] ?? '') : ($_GET['lang'] ?? 'ru'));
if (!in_array($lang, LANGUAGES, true)) {
    respond(400, ['ok' => false, 'error' => 'unknown_language']);
}

$configFile = __DIR__ . '/config.php';
$config = is_file($configFile) ? require $configFile : [];
if ($method === 'POST' && !isAdmin($config)) {
    respond(401, ['ok' => false, 'error' => 'not_logged_in']);
}
if (empty($config['db_name'])) {
    error_log('resume.php: database is not configured');
    respond(503, ['ok' => false, 'error' => 'not_configured']);
}

try {
    $pdo = connectDb($config);
    createTables($pdo);
    seedIfEmpty($pdo);
    if ($method === 'POST') {
        $section = (string) ($input['section'] ?? '');
        $id = isset($input['id']) ? (string) $input['id'] : null;
        if (!empty($input['delete'])) {
            deleteItem($pdo, $lang, $section, $id);
        } else {
            saveSection($pdo, $lang, $section, $id, $input['data'] ?? null);
        }
        respond(200, ['ok' => true]);
    }
    $resume = loadResume($pdo, $lang);
} catch (InvalidInput $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    respond(400, ['ok' => false, 'error' => 'invalid_field', 'field' => $e->getMessage()]);
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
