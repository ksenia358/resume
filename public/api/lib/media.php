<?php

declare(strict_types=1);

/**
 * Removes a file from /media once nothing needs it: a saved version of the resume may still point at it,
 * and restoring that version would show a broken picture.
 */
function deleteMediaFile(PDO $pdo, string $src): void
{
    if (!preg_match('#^/media/[\w-]+\.(jpg|png|webp)$#', $src)) {
        return;
    }
    if ($pdo->query("SHOW TABLES LIKE 'resume_versions'")->fetch() !== false) {
        $stmt = $pdo->prepare('SELECT COUNT(*) FROM resume_versions WHERE data LIKE ?');
        $stmt->execute(['%' . json_encode($src, JSON_UNESCAPED_SLASHES) . '%']);
        if ((int) $stmt->fetchColumn() > 0) {
            return;
        }
    }
    @unlink(dirname(__DIR__, 2) . $src);
}
