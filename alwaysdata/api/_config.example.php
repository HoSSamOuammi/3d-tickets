<?php
declare(strict_types=1);

/*
 * Copy this file to _config.php and replace the placeholder values.
 *
 * SHA-256 helper:
 * php -r "echo hash('sha256', 'YourPlainTextValue'), PHP_EOL;"
 *
 * The constants below are optional overrides. If you omit them, the
 * defaults from _bootstrap.php remain active.
 */

// Optional fallback check-in credentials.
const CHECK_IN_LOGIN_EMAIL = 'comite@3dimpact.ma';
const CHECK_IN_LOGIN_PASSWORD_HASH = 'replace_with_sha256_hash';

// Optional admin overrides.
const ADMIN_ACCESS_HASH = 'replace_with_sha256_hash';
const ADMIN_DELETE_PASSWORD_HASH = 'replace_with_sha256_hash';
const ADMIN_PORTAL_USERNAME = 'Admin';
const ADMIN_PORTAL_PASSWORD_HASH = 'replace_with_sha256_hash';
const ADMIN_PORTAL_PASSWORD_HASH_ALTERNATE = 'replace_with_optional_sha256_hash';
