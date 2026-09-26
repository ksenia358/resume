<?php

declare(strict_types=1);

function connectDb(array $config): PDO
{
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
    return $pdo;
}
