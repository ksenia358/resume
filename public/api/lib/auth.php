<?php

declare(strict_types=1);

/**
 * Admin session for the resume editor: one admin, one password.
 *
 * config.php holds only a hash of the password (admin_password_hash, made from the ADMIN_PASSWORD
 * secret during deploy). After login the browser gets a signed cookie with an expiry time; nothing is
 * stored on the server, so shared hosting cleaning its session files doesn't log the admin out.
 * The hash doubles as the signing key: changing the password logs out every browser.
 */

const ADMIN_COOKIE = 'resume_admin';
const ADMIN_SESSION_DAYS = 7;

function adminSignature(array $config, string $payload): string
{
    return hash_hmac('sha256', $payload, (string) $config['admin_password_hash']);
}

function isAdmin(array $config): bool
{
    if (empty($config['admin_password_hash'])) {
        return false;
    }
    $cookie = (string) ($_COOKIE[ADMIN_COOKIE] ?? '');
    [$expires, $signature] = array_pad(explode('.', $cookie, 2), 2, '');
    return ctype_digit($expires)
        && (int) $expires > time()
        && hash_equals(adminSignature($config, $expires), $signature);
}

function setAdminCookie(array $config): void
{
    $expires = (string) (time() + ADMIN_SESSION_DAYS * 86400);
    setcookie(ADMIN_COOKIE, $expires . '.' . adminSignature($config, $expires), adminCookieOptions((int) $expires));
}

function clearAdminCookie(): void
{
    setcookie(ADMIN_COOKIE, '', adminCookieOptions(1));
}

function adminCookieOptions(int $expires): array
{
    return [
        'expires' => $expires,
        'path' => '/',
        // Only over HTTPS, invisible to JavaScript, never sent from other sites (so no CSRF).
        'secure' => true,
        'httponly' => true,
        'samesite' => 'Strict',
    ];
}
