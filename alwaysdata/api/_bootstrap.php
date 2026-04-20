<?php
declare(strict_types=1);

session_set_cookie_params([
    'lifetime' => 86400,
    'secure' => true,
    'httponly' => true,
    'samesite' => 'Strict',
]);
session_start();

if (is_file(__DIR__ . '/_config.php')) {
    require __DIR__ . '/_config.php';
}

if (!defined('ADMIN_ACCESS_HASH')) {
    define('ADMIN_ACCESS_HASH', 'fae59cd5400a0f4dc6ec3ce6991671bfa14a4fc4e9e3dcae57e83c6d841547b5');
}

if (!defined('ADMIN_DELETE_PASSWORD_HASH')) {
    define('ADMIN_DELETE_PASSWORD_HASH', 'a6dea4e4fbac230762a39d5fafa56f2f9f01942bce6f7f950f37c0afac40f7e2');
}

if (!defined('ADMIN_PORTAL_USERNAME')) {
    define('ADMIN_PORTAL_USERNAME', 'Admin');
}

if (!defined('ADMIN_PORTAL_PASSWORD_HASH')) {
    define('ADMIN_PORTAL_PASSWORD_HASH', '3e5f98c04d7174dff2c47ec5acb53620a93b84c9a07f27309c433a4b6c251555');
}

if (!defined('ADMIN_PORTAL_PASSWORD_HASH_ALTERNATE')) {
    define('ADMIN_PORTAL_PASSWORD_HASH_ALTERNATE', 'a510ccec45eb8e1d10b741d017b9ccb7b54bf5cc32cfd9b3241dd03abc36fb05');
}

if (!defined('DEFAULT_EXTERNAL_TICKET_PRICE')) {
    define('DEFAULT_EXTERNAL_TICKET_PRICE', 50);
}

if (!defined('STORAGE_DIRECTORY')) {
    define('STORAGE_DIRECTORY', __DIR__ . '/../storage');
}

if (!defined('DATABASE_PATH')) {
    define('DATABASE_PATH', STORAGE_DIRECTORY . '/3d-impact.sqlite');
}

if (!defined('CHECK_IN_LOGIN_EMAIL')) {
    define('CHECK_IN_LOGIN_EMAIL', '');
}

if (!defined('CHECK_IN_LOGIN_PASSWORD_HASH')) {
    define('CHECK_IN_LOGIN_PASSWORD_HASH', '');
}

header('Content-Type: application/json; charset=UTF-8');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Strict-Transport-Security: max-age=31536000; includeSubDomains');
header("Content-Security-Policy: default-src 'none';");

function respond(array $payload, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_SLASHES);
    exit;
}

function read_json_body(): array
{
    $rawBody = file_get_contents('php://input');

    if ($rawBody === false || $rawBody === '') {
        return [];
    }

    $data = json_decode($rawBody, true);

    return is_array($data) ? $data : [];
}

function get_client_ip(): string
{
    $ip = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    if (strpos($ip, ',') !== false) {
        $ip = explode(',', $ip)[0];
    }
    return trim($ip);
}

function check_rate_limit(string $action, string $identifier, int $maxAttempts, int $lockWindowSeconds): void
{
    $connection = database();
    
    // Clean up old entries
    $statement = $connection->prepare("DELETE FROM rate_limits WHERE created_at < datetime('now', '-' || :seconds || ' seconds')");
    $statement->execute([':seconds' => (string)$lockWindowSeconds]);
    
    // Count recent attempts
    $statement = $connection->prepare('SELECT COUNT(*) FROM rate_limits WHERE action = :action AND identifier = :identifier');
    $statement->execute([':action' => $action, ':identifier' => $identifier]);
    $attempts = (int) $statement->fetchColumn();
    
    if ($attempts >= $maxAttempts) {
        respond(['ok' => false, 'message' => 'Trop de tentatives. Veuillez réessayer plus tard.'], 429);
    }
    
    // Record new attempt
    $statement = $connection->prepare('INSERT INTO rate_limits (action, identifier, created_at) VALUES (:action, :identifier, datetime("now"))');
    $statement->execute([':action' => $action, ':identifier' => $identifier]);
}

function ensure_storage_directory(): void
{
    if (!is_dir(STORAGE_DIRECTORY) && !mkdir(STORAGE_DIRECTORY, 0775, true) && !is_dir(STORAGE_DIRECTORY)) {
        respond([
            'ok' => false,
            'message' => "Impossible d'initialiser le dossier de stockage serveur.",
        ], 500);
    }
}

function ensure_sqlite_column(PDO $connection, string $tableName, string $columnName, string $definition): void
{
    $columns = $connection->query("PRAGMA table_info($tableName)")->fetchAll();

    foreach ($columns as $column) {
        if (($column['name'] ?? null) === $columnName) {
            return;
        }
    }

    $connection->exec("ALTER TABLE $tableName ADD COLUMN $columnName $definition");
}

function begin_immediate_transaction(PDO $connection): void
{
    if ($connection->inTransaction()) {
        return;
    }

    $connection->exec('BEGIN IMMEDIATE TRANSACTION');
}

function database(): PDO
{
    static $connection = null;

    if ($connection instanceof PDO) {
        return $connection;
    }

    ensure_storage_directory();

    try {
        $connection = new PDO('sqlite:' . DATABASE_PATH);
    } catch (Throwable $exception) {
        respond([
            'ok' => false,
            'message' => "Le serveur PHP ne dispose pas du support SQLite requis ou n'arrive pas a ouvrir la base de donnees.",
        ], 500);
    }

    $connection->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $connection->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    $connection->exec('PRAGMA foreign_keys = ON;');
    $connection->exec('PRAGMA journal_mode = WAL;');

    $connection->exec(
        'CREATE TABLE IF NOT EXISTS participants (
            id TEXT PRIMARY KEY,
            first_name TEXT NOT NULL,
            last_name TEXT NOT NULL,
            email TEXT NOT NULL,
            email_normalized TEXT NOT NULL,
            phone TEXT NOT NULL,
            phone_normalized TEXT NOT NULL,
            type TEXT NOT NULL,
            photo TEXT NOT NULL,
            created_at TEXT NOT NULL,
            is_confirmed INTEGER NOT NULL DEFAULT 0,
            confirmed_at TEXT NULL
        )'
    );

    ensure_sqlite_column($connection, 'participants', 'checked_in_at', 'TEXT NULL');

    $connection->exec(
        'CREATE UNIQUE INDEX IF NOT EXISTS idx_participants_email_normalized
         ON participants (email_normalized)'
    );

    $connection->exec(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_participants_phone_normalized
         ON participants (phone_normalized)
         WHERE phone_normalized <> ''"
    );

    $connection->exec(
        'CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )'
    );

    $connection->exec(
        'CREATE TABLE IF NOT EXISTS committee_users (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT NOT NULL,
            email_normalized TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            password_plaintext TEXT NULL,
            is_active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            last_login_at TEXT NULL
        )'
    );

    ensure_sqlite_column($connection, 'committee_users', 'password_plaintext', 'TEXT NULL');
    $connection->exec('UPDATE committee_users SET password_plaintext = NULL WHERE password_plaintext IS NOT NULL');

    $connection->exec(
        'CREATE UNIQUE INDEX IF NOT EXISTS idx_committee_users_email_normalized
         ON committee_users (email_normalized)'
    );

    $connection->exec(
        'CREATE TABLE IF NOT EXISTS committee_members (
            id TEXT PRIMARY KEY,
            first_name TEXT NOT NULL,
            last_name TEXT NOT NULL,
            email TEXT NOT NULL,
            email_normalized TEXT NOT NULL,
            phone TEXT NOT NULL,
            phone_normalized TEXT NOT NULL,
            badge_type TEXT NOT NULL DEFAULT \'committee\',
            created_at TEXT NOT NULL,
            checked_in_at TEXT NULL
        )'
    );

    ensure_sqlite_column($connection, 'committee_members', 'badge_type', "TEXT NOT NULL DEFAULT 'committee'");

    $connection->exec(
        'CREATE UNIQUE INDEX IF NOT EXISTS idx_committee_members_email_normalized
         ON committee_members (email_normalized)'
    );

    $connection->exec(
        'CREATE TABLE IF NOT EXISTS professors (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            primary_email TEXT NOT NULL,
            primary_email_normalized TEXT NOT NULL,
            secondary_email TEXT NULL,
            secondary_email_normalized TEXT NULL,
            created_at TEXT NOT NULL
        )'
    );

    $connection->exec(
        'CREATE INDEX IF NOT EXISTS idx_professors_primary_email_normalized
         ON professors (primary_email_normalized)'
    );

    $connection->exec(
        'CREATE INDEX IF NOT EXISTS idx_professors_secondary_email_normalized
         ON professors (secondary_email_normalized)'
    );

    $connection->exec(
        'CREATE TABLE IF NOT EXISTS rate_limits (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            action TEXT NOT NULL,
            identifier TEXT NOT NULL,
            created_at TEXT NOT NULL
        )'
    );

    $connection->exec(
        'CREATE INDEX IF NOT EXISTS idx_rate_limits_action_identifier
         ON rate_limits (action, identifier)'
    );

    $statement = $connection->prepare(
        'INSERT INTO settings (key, value)
         VALUES (:key, :value)
         ON CONFLICT(key) DO NOTHING'
    );
    $statement->execute([
        ':key' => 'external_ticket_price',
        ':value' => (string) DEFAULT_EXTERNAL_TICKET_PRICE,
    ]);

    $statement->execute([
        ':key' => 'is_registration_closed',
        ':value' => '0',
    ]);

    $statement->execute([
        ':key' => 'max_inside_capacity',
        ':value' => '',
    ]);

    $statement->execute([
        ':key' => 'jourj_manual_adjustment',
        ':value' => '0',
    ]);

    return $connection;
}

function normalize_email(string $value): string
{
    return strtolower(trim($value));
}

function normalize_phone(string $value): string
{
    $digitsOnly = preg_replace('/\D+/', '', $value) ?? '';

    if ($digitsOnly === '') {
        return '';
    }

    $withoutInternationalPrefix = str_starts_with($digitsOnly, '00')
        ? substr($digitsOnly, 2)
        : $digitsOnly;

    if (str_starts_with($withoutInternationalPrefix, '212')) {
        return '212' . ltrim(substr($withoutInternationalPrefix, 3), '0');
    }

    if (strlen($withoutInternationalPrefix) === 10 && str_starts_with($withoutInternationalPrefix, '0')) {
        return '212' . substr($withoutInternationalPrefix, 1);
    }

    if (strlen($withoutInternationalPrefix) === 9 && preg_match('/^[5-7]/', $withoutInternationalPrefix) === 1) {
        return '212' . $withoutInternationalPrefix;
    }

    return $withoutInternationalPrefix;
}

function normalize_text(string $value): string
{
    return strtolower(trim($value));
}

function normalize_committee_badge_type(string $value): string
{
    $normalizedValue = strtolower(trim($value));

    if (in_array($normalizedValue, ['ensatpress', 'ensat-press', 'press', 'presse', 'committee_press', 'committee_presse', 'comite_presse', 'comite presse', 'comitepress'], true)) {
        return 'ensatpress';
    }

    return 'committee';
}

function build_admin_credential_seed(array $fields): string
{
    return sprintf(
        '%s|%s|%s|%s',
        normalize_text((string) ($fields['firstName'] ?? '')),
        normalize_text((string) ($fields['lastName'] ?? '')),
        trim((string) ($fields['phone'] ?? '')),
        normalize_text((string) ($fields['email'] ?? ''))
    );
}

function is_admin_access_attempt(array $fields): bool
{
    return hash_equals(ADMIN_ACCESS_HASH, hash('sha256', build_admin_credential_seed($fields)));
}

function verify_admin_delete_password(string $password): bool
{
    return password_verify(trim($password), ADMIN_DELETE_PASSWORD_HASH);
}

function verify_admin_portal_credentials(string $username, string $password): bool
{
    $isUsernameCorrect = hash_equals(
        strtolower(trim(ADMIN_PORTAL_USERNAME)),
        strtolower(trim($username))
    );

    if (!$isUsernameCorrect) {
        return false;
    }

    return password_verify($password, ADMIN_PORTAL_PASSWORD_HASH) ||
           password_verify($password, ADMIN_PORTAL_PASSWORD_HASH_ALTERNATE);
}

function is_admin_authenticated(): bool
{
    return ($_SESSION['admin_authenticated'] ?? false) === true;
}

function is_check_in_configured(): bool
{
    return trim((string) CHECK_IN_LOGIN_EMAIL) !== '' && trim((string) CHECK_IN_LOGIN_PASSWORD_HASH) !== '';
}

function verify_check_in_credentials(string $email, string $password): bool
{
    if (!is_check_in_configured()) {
        return false;
    }

    $isEmailCorrect = hash_equals(
        strtolower(trim((string) CHECK_IN_LOGIN_EMAIL)),
        strtolower(trim($email))
    );

    if (!$isEmailCorrect) {
        return false;
    }

    return password_verify($password, (string) CHECK_IN_LOGIN_PASSWORD_HASH);
}

function is_check_in_authenticated(): bool
{
    return ($_SESSION['check_in_authenticated'] ?? false) === true;
}

function require_admin(): void
{
    if (!is_admin_authenticated()) {
        respond([
            'ok' => false,
            'message' => 'Accès admin requis.',
        ], 401);
    }
}

function require_check_in(): void
{
    if (!is_check_in_authenticated() && !is_admin_authenticated()) {
        respond([
            'ok' => false,
            'message' => 'Accès check-in requis.',
        ], 401);
    }
}

function participant_from_row(array $row): array
{
    $confirmedAt = $row['confirmed_at'] !== null ? (string) $row['confirmed_at'] : (string) $row['created_at'];

    return [
        'id' => (string) $row['id'],
        'firstName' => (string) $row['first_name'],
        'lastName' => (string) $row['last_name'],
        'email' => (string) $row['email'],
        'phone' => (string) $row['phone'],
        'type' => (string) $row['type'],
        'photo' => (string) $row['photo'],
        'createdAt' => (string) $row['created_at'],
        'isConfirmed' => true,
        'confirmedAt' => $confirmedAt,
        'checkedInAt' => $row['checked_in_at'] !== null ? (string) $row['checked_in_at'] : null,
    ];
}

function committee_user_from_row(array $row): array
{
    $user = [
        'id' => (string) $row['id'],
        'name' => (string) $row['name'],
        'email' => (string) $row['email'],
        'isActive' => ((int) $row['is_active']) === 1,
        'createdAt' => (string) $row['created_at'],
        'updatedAt' => (string) $row['updated_at'],
        'lastLoginAt' => $row['last_login_at'] !== null ? (string) $row['last_login_at'] : null,
    ];

    return $user;
}

function committee_member_from_row(array $row): array
{
    return [
        'id' => (string) $row['id'],
        'firstName' => (string) $row['first_name'],
        'lastName' => (string) $row['last_name'],
        'email' => (string) $row['email'],
        'phone' => (string) $row['phone'],
        'badgeType' => normalize_committee_badge_type((string) ($row['badge_type'] ?? 'committee')),
        'createdAt' => (string) $row['created_at'],
        'checkedInAt' => $row['checked_in_at'] !== null ? (string) $row['checked_in_at'] : null,
    ];
}

function professor_from_row(array $row): array
{
    return [
        'id' => (string) $row['id'],
        'name' => (string) $row['name'],
        'primaryEmail' => (string) $row['primary_email'],
        'secondaryEmail' => $row['secondary_email'] !== null ? (string) $row['secondary_email'] : null,
        'createdAt' => (string) $row['created_at'],
    ];
}

function list_participants(): array
{
    $statement = database()->query(
        'SELECT *
         FROM participants
         ORDER BY datetime(created_at) DESC, rowid DESC'
    );

    $participants = [];

    foreach ($statement->fetchAll() as $row) {
        $participants[] = participant_from_row($row);
    }

    return $participants;
}

function count_present_participants(): int
{
    $statement = database()->query(
        'SELECT COUNT(*)
         FROM participants
         WHERE checked_in_at IS NOT NULL'
    );

    return (int) $statement->fetchColumn();
}

function list_committee_users(): array
{
    $statement = database()->query(
        'SELECT *
         FROM committee_users
         ORDER BY datetime(created_at) DESC, rowid DESC'
    );

    $users = [];

    foreach ($statement->fetchAll() as $row) {
        $users[] = committee_user_from_row($row);
    }

    return $users;
}

function list_committee_members(): array
{
    $statement = database()->query(
        'SELECT *
         FROM committee_members
         ORDER BY datetime(created_at) DESC, rowid DESC'
    );

    $members = [];

    foreach ($statement->fetchAll() as $row) {
        $members[] = committee_member_from_row($row);
    }

    return $members;
}

function count_present_committee_members(): int
{
    $statement = database()->query(
        'SELECT COUNT(*)
         FROM committee_members
         WHERE checked_in_at IS NOT NULL'
    );

    return (int) $statement->fetchColumn();
}

function list_professors(): array
{
    $statement = database()->query(
        'SELECT *
         FROM professors
         ORDER BY datetime(created_at) DESC, rowid DESC'
    );

    $professors = [];

    foreach ($statement->fetchAll() as $row) {
        $professors[] = professor_from_row($row);
    }

    return $professors;
}

function find_participant_by_id(string $participantId): ?array
{
    $statement = database()->prepare('SELECT * FROM participants WHERE id = :id LIMIT 1');
    $statement->execute([':id' => $participantId]);
    $row = $statement->fetch();

    return is_array($row) ? participant_from_row($row) : null;
}

function find_committee_user_row_by_id(string $userId): ?array
{
    $statement = database()->prepare('SELECT * FROM committee_users WHERE id = :id LIMIT 1');
    $statement->execute([':id' => $userId]);
    $row = $statement->fetch();

    return is_array($row) ? $row : null;
}

function find_committee_user_by_id(string $userId): ?array
{
    $row = find_committee_user_row_by_id($userId);

    return $row !== null ? committee_user_from_row($row) : null;
}

function find_committee_member_row_by_id(string $memberId): ?array
{
    $normalizedMemberId = strtolower(trim($memberId));

    if ($normalizedMemberId === '') {
        return null;
    }

    $statement = database()->prepare('SELECT * FROM committee_members WHERE id = :id LIMIT 1');
    $statement->execute([':id' => $normalizedMemberId]);
    $row = $statement->fetch();

    return is_array($row) ? $row : null;
}

function find_committee_member_by_id(string $memberId): ?array
{
    $row = find_committee_member_row_by_id($memberId);

    return $row !== null ? committee_member_from_row($row) : null;
}

function find_professor_row_by_id(string $professorId): ?array
{
    $normalizedProfessorId = strtolower(trim($professorId));

    if ($normalizedProfessorId === '') {
        return null;
    }

    $statement = database()->prepare('SELECT * FROM professors WHERE id = :id LIMIT 1');
    $statement->execute([':id' => $normalizedProfessorId]);
    $row = $statement->fetch();

    return is_array($row) ? $row : null;
}

function find_professor_by_id(string $professorId): ?array
{
    $row = find_professor_row_by_id($professorId);

    return $row !== null ? professor_from_row($row) : null;
}

function find_committee_user_row_by_email(string $email): ?array
{
    $statement = database()->prepare(
        'SELECT *
         FROM committee_users
         WHERE email_normalized = :email
         LIMIT 1'
    );
    $statement->execute([':email' => normalize_email($email)]);
    $row = $statement->fetch();

    return is_array($row) ? $row : null;
}

function find_committee_member_row_by_email(string $email): ?array
{
    $statement = database()->prepare(
        'SELECT *
         FROM committee_members
         WHERE email_normalized = :email
         LIMIT 1'
    );
    $statement->execute([':email' => normalize_email($email)]);
    $row = $statement->fetch();

    return is_array($row) ? $row : null;
}

function find_committee_member_row_by_phone(string $phone): ?array
{
    $phoneNormalized = normalize_phone($phone);

    if ($phoneNormalized === '') {
        return null;
    }

    $statement = database()->prepare(
        'SELECT *
         FROM committee_members
         WHERE phone_normalized = :phone
         LIMIT 1'
    );
    $statement->execute([':phone' => $phoneNormalized]);
    $row = $statement->fetch();

    return is_array($row) ? $row : null;
}

function find_professor_row_by_email(string $email): ?array
{
    $emailNormalized = normalize_email($email);

    if ($emailNormalized === '') {
        return null;
    }

    $statement = database()->prepare(
        'SELECT *
         FROM professors
         WHERE primary_email_normalized = :email
            OR secondary_email_normalized = :email
         LIMIT 1'
    );
    $statement->execute([':email' => $emailNormalized]);
    $row = $statement->fetch();

    return is_array($row) ? $row : null;
}

function find_participant_by_ticket_id(string $ticketId): ?array
{
    return find_participant_by_id(strtoupper(trim($ticketId)));
}

function find_participant_by_contact(string $query): ?array
{
    $trimmedQuery = trim($query);

    if ($trimmedQuery === '') {
        return null;
    }

    if (filter_var($trimmedQuery, FILTER_VALIDATE_EMAIL) !== false) {
        $statement = database()->prepare(
            'SELECT *
             FROM participants
             WHERE email_normalized = :email
             LIMIT 1'
        );
        $statement->execute([':email' => normalize_email($trimmedQuery)]);
        $row = $statement->fetch();

        return is_array($row) ? participant_from_row($row) : null;
    }

    $phoneNormalized = normalize_phone($trimmedQuery);

    if ($phoneNormalized === '') {
        return null;
    }

    $statement = database()->prepare(
        'SELECT *
         FROM participants
         WHERE phone_normalized = :phone
         LIMIT 1'
    );
    $statement->execute([':phone' => $phoneNormalized]);
    $row = $statement->fetch();

    return is_array($row) ? participant_from_row($row) : null;
}

function find_committee_member_by_contact(string $query): ?array
{
    $trimmedQuery = trim($query);

    if ($trimmedQuery === '') {
        return null;
    }

    if (filter_var($trimmedQuery, FILTER_VALIDATE_EMAIL) !== false) {
        $row = find_committee_member_row_by_email($trimmedQuery);
        return is_array($row) ? committee_member_from_row($row) : null;
    }

    $row = find_committee_member_row_by_phone($trimmedQuery);

    return is_array($row) ? committee_member_from_row($row) : null;
}

function get_duplicate_matches(string $emailNormalized, string $phoneNormalized): array
{
    $emailMatch = null;
    $phoneMatch = null;

    if ($emailNormalized !== '') {
        $statement = database()->prepare(
            'SELECT *
             FROM participants
             WHERE email_normalized = :email
             LIMIT 1'
        );
        $statement->execute([':email' => $emailNormalized]);
        $row = $statement->fetch();
        $emailMatch = is_array($row) ? participant_from_row($row) : null;
    }

    if ($phoneNormalized !== '') {
        $statement = database()->prepare(
            'SELECT *
             FROM participants
             WHERE phone_normalized = :phone
             LIMIT 1'
        );
        $statement->execute([':phone' => $phoneNormalized]);
        $row = $statement->fetch();
        $phoneMatch = is_array($row) ? participant_from_row($row) : null;
    }

    return [$emailMatch, $phoneMatch];
}

function get_committee_member_duplicate_matches(string $emailNormalized, string $phoneNormalized): array
{
    $emailMatch = null;
    $phoneMatch = null;

    if ($emailNormalized !== '') {
        $row = find_committee_member_row_by_email($emailNormalized);
        $emailMatch = is_array($row) ? committee_member_from_row($row) : null;
    }

    if ($phoneNormalized !== '') {
        $row = find_committee_member_row_by_phone($phoneNormalized);
        $phoneMatch = is_array($row) ? committee_member_from_row($row) : null;
    }

    return [$emailMatch, $phoneMatch];
}

function create_ticket_id(): string
{
    for ($attempt = 0; $attempt < 12; $attempt += 1) {
        $candidate = 'ENA-' . strtoupper(substr(bin2hex(random_bytes(4)), 0, 8));
        $statement = database()->prepare('SELECT COUNT(*) FROM participants WHERE id = :id');
        $statement->execute([':id' => $candidate]);

        if ((int) $statement->fetchColumn() === 0) {
            return $candidate;
        }
    }

    return 'ENA-' . strtoupper(bin2hex(random_bytes(6)));
}

function create_participant(array $payload): array
{
    $now = gmdate('c');
    $participant = [
        'id' => create_ticket_id(),
        'firstName' => trim((string) ($payload['firstName'] ?? '')),
        'lastName' => trim((string) ($payload['lastName'] ?? '')),
        'email' => trim((string) ($payload['email'] ?? '')),
        'phone' => trim((string) ($payload['phone'] ?? '')),
        'type' => ($payload['type'] ?? 'internal') === 'external' ? 'external' : 'internal',
        'photo' => trim((string) ($payload['photo'] ?? '')),
        'createdAt' => $now,
        'isConfirmed' => true,
        'confirmedAt' => $now,
        'checkedInAt' => null,
    ];

    $statement = database()->prepare(
        'INSERT INTO participants (
            id,
            first_name,
            last_name,
            email,
            email_normalized,
            phone,
            phone_normalized,
            type,
            photo,
            created_at,
            is_confirmed,
            confirmed_at,
            checked_in_at
        ) VALUES (
            :id,
            :first_name,
            :last_name,
            :email,
            :email_normalized,
            :phone,
            :phone_normalized,
            :type,
            :photo,
            :created_at,
            :is_confirmed,
            :confirmed_at,
            :checked_in_at
        )'
    );

    $statement->execute([
        ':id' => $participant['id'],
        ':first_name' => $participant['firstName'],
        ':last_name' => $participant['lastName'],
        ':email' => $participant['email'],
        ':email_normalized' => normalize_email($participant['email']),
        ':phone' => $participant['phone'],
        ':phone_normalized' => normalize_phone($participant['phone']),
        ':type' => $participant['type'],
        ':photo' => $participant['photo'],
        ':created_at' => $participant['createdAt'],
        ':is_confirmed' => $participant['isConfirmed'] ? 1 : 0,
        ':confirmed_at' => $participant['confirmedAt'],
        ':checked_in_at' => $participant['checkedInAt'],
    ]);

    return $participant;
}

function update_participant(string $participantId, array $payload): ?array
{
    $participant = find_participant_by_id($participantId);

    if ($participant === null) {
        return null;
    }

    $now = gmdate('c');
    $type = ($payload['type'] ?? 'internal') === 'external' ? 'external' : 'internal';

    $isConfirmed = true;
    $confirmedAt = $participant['confirmedAt'] ?? $now;

    $updatedParticipant = [
        'id' => $participantId,
        'firstName' => trim((string) ($payload['firstName'] ?? '')),
        'lastName' => trim((string) ($payload['lastName'] ?? '')),
        'email' => trim((string) ($payload['email'] ?? '')),
        'phone' => trim((string) ($payload['phone'] ?? '')),
        'type' => $type,
        'photo' => trim((string) ($payload['photo'] ?? '')),
        'createdAt' => $participant['createdAt'],
        'isConfirmed' => $isConfirmed,
        'confirmedAt' => $confirmedAt,
        'checkedInAt' => $participant['checkedInAt'] ?? null,
    ];

    $statement = database()->prepare(
        'UPDATE participants SET
            first_name = :first_name,
            last_name = :last_name,
            email = :email,
            email_normalized = :email_normalized,
            phone = :phone,
            phone_normalized = :phone_normalized,
            type = :type,
            photo = :photo,
            is_confirmed = :is_confirmed,
            confirmed_at = :confirmed_at,
            checked_in_at = :checked_in_at
         WHERE id = :id'
    );

    $statement->execute([
        ':id' => $updatedParticipant['id'],
        ':first_name' => $updatedParticipant['firstName'],
        ':last_name' => $updatedParticipant['lastName'],
        ':email' => $updatedParticipant['email'],
        ':email_normalized' => normalize_email($updatedParticipant['email']),
        ':phone' => $updatedParticipant['phone'],
        ':phone_normalized' => normalize_phone($updatedParticipant['phone']),
        ':type' => $updatedParticipant['type'],
        ':photo' => $updatedParticipant['photo'],
        ':is_confirmed' => $updatedParticipant['isConfirmed'] ? 1 : 0,
        ':confirmed_at' => $updatedParticipant['confirmedAt'],
        ':checked_in_at' => $updatedParticipant['checkedInAt'],
    ]);

    return $updatedParticipant;
}

function confirm_external_participant(string $participantId): ?array
{
    $participant = find_participant_by_id($participantId);

    if ($participant === null) {
        return null;
    }

    if ($participant['type'] !== 'external') {
        return $participant;
    }

    $confirmedAt = gmdate('c');
    $statement = database()->prepare(
        'UPDATE participants
         SET is_confirmed = 1,
             confirmed_at = :confirmed_at
         WHERE id = :id'
    );
    $statement->execute([
        ':confirmed_at' => $confirmedAt,
        ':id' => $participantId,
    ]);

    return find_participant_by_id($participantId);
}

function mark_participant_checked_in(string $participantId): ?array
{
    $connection = database();
    begin_immediate_transaction($connection);

    try {
        $participant = find_participant_by_id($participantId);

        if ($participant === null) {
            $connection->commit();
            return null;
        }

        if ($participant['checkedInAt'] !== null) {
            $connection->commit();
            return $participant;
        }

        if ((get_jourj_snapshot()['isCapacityReached'] ?? false) === true) {
            $connection->rollBack();
            respond([
                'ok' => false,
                'message' => "Capacite maximale atteinte. Aucun nouveau check-in ne peut etre enregistre.",
            ], 409);
        }

        $checkedInAt = gmdate('c');
        $statement = $connection->prepare(
            'UPDATE participants
             SET checked_in_at = :checked_in_at
             WHERE id = :id'
        );
        $statement->execute([
            ':checked_in_at' => $checkedInAt,
            ':id' => $participantId,
        ]);

        $updatedParticipant = find_participant_by_id($participantId);
        $connection->commit();

        return $updatedParticipant;
    } catch (Throwable $exception) {
        if ($connection->inTransaction()) {
            $connection->rollBack();
        }

        throw $exception;
    }
}

function clear_participant_checked_in(string $participantId): ?array
{
    $participant = find_participant_by_id($participantId);

    if ($participant === null) {
        return null;
    }

    if ($participant['checkedInAt'] === null) {
        return $participant;
    }

    $statement = database()->prepare(
        'UPDATE participants
         SET checked_in_at = NULL
         WHERE id = :id'
    );
    $statement->execute([
        ':id' => $participantId,
    ]);

    return find_participant_by_id($participantId);
}

function delete_participant(string $participantId): bool
{
    $statement = database()->prepare('DELETE FROM participants WHERE id = :id');
    $statement->execute([':id' => $participantId]);
    return $statement->rowCount() > 0;
}

function create_committee_user(array $payload): array
{
    $name = trim((string) ($payload['name'] ?? ''));
    $email = trim((string) ($payload['email'] ?? ''));
    $password = (string) ($payload['password'] ?? '');
    $isActive = ($payload['isActive'] ?? true) !== false;
    $now = gmdate('c');
    $user = [
        'id' => bin2hex(random_bytes(8)),
        'name' => $name,
        'email' => $email,
        'isActive' => $isActive,
        'createdAt' => $now,
        'updatedAt' => $now,
        'lastLoginAt' => null,
    ];

    $statement = database()->prepare(
        'INSERT INTO committee_users (
            id,
            name,
            email,
            email_normalized,
            password_hash,
            is_active,
            created_at,
            updated_at,
            last_login_at
        ) VALUES (
            :id,
            :name,
            :email,
            :email_normalized,
            :password_hash,
            :is_active,
            :created_at,
            :updated_at,
            :last_login_at
        )'
    );

    $statement->execute([
        ':id' => $user['id'],
        ':name' => $user['name'],
        ':email' => $user['email'],
        ':email_normalized' => normalize_email($user['email']),
        ':password_hash' => password_hash($password, PASSWORD_BCRYPT),
        ':is_active' => $user['isActive'] ? 1 : 0,
        ':created_at' => $user['createdAt'],
        ':updated_at' => $user['updatedAt'],
        ':last_login_at' => null,
    ]);

    return $user;
}

function update_committee_user(string $userId, array $payload): ?array
{
    $existingRow = find_committee_user_row_by_id($userId);

    if ($existingRow === null) {
        return null;
    }

    $name = trim((string) ($payload['name'] ?? $existingRow['name']));
    $email = trim((string) ($payload['email'] ?? $existingRow['email']));
    $password = (string) ($payload['password'] ?? '');
    $updatedAt = gmdate('c');
    $passwordHash = $password !== '' ? password_hash($password, PASSWORD_BCRYPT) : (string) $existingRow['password_hash'];

    $statement = database()->prepare(
        'UPDATE committee_users
         SET name = :name,
             email = :email,
             email_normalized = :email_normalized,
             password_hash = :password_hash,
             updated_at = :updated_at
         WHERE id = :id'
    );
    $statement->execute([
        ':id' => $userId,
        ':name' => $name,
        ':email' => $email,
        ':email_normalized' => normalize_email($email),
        ':password_hash' => $passwordHash,
        ':updated_at' => $updatedAt,
    ]);

    return find_committee_user_by_id($userId);
}

function set_committee_user_access(string $userId, bool $isActive): ?array
{
    $existingUser = find_committee_user_by_id($userId);

    if ($existingUser === null) {
        return null;
    }

    $statement = database()->prepare(
        'UPDATE committee_users
         SET is_active = :is_active,
             updated_at = :updated_at
         WHERE id = :id'
    );
    $statement->execute([
        ':is_active' => $isActive ? 1 : 0,
        ':updated_at' => gmdate('c'),
        ':id' => $userId,
    ]);

    return find_committee_user_by_id($userId);
}

function delete_committee_user(string $userId): bool
{
    $statement = database()->prepare('DELETE FROM committee_users WHERE id = :id');
    $statement->execute([':id' => $userId]);

    return $statement->rowCount() > 0;
}

function create_committee_member(array $payload): array
{
    $now = gmdate('c');
    $badgeType = normalize_committee_badge_type((string) ($payload['badgeType'] ?? 'committee'));
    $member = [
        'id' => bin2hex(random_bytes(8)),
        'firstName' => trim((string) ($payload['firstName'] ?? '')),
        'lastName' => trim((string) ($payload['lastName'] ?? '')),
        'email' => trim((string) ($payload['email'] ?? '')),
        'phone' => trim((string) ($payload['phone'] ?? '')),
        'badgeType' => $badgeType,
        'createdAt' => $now,
        'checkedInAt' => null,
    ];

    $statement = database()->prepare(
        'INSERT INTO committee_members (
            id,
            first_name,
            last_name,
            email,
            email_normalized,
            phone,
            phone_normalized,
            badge_type,
            created_at,
            checked_in_at
        ) VALUES (
            :id,
            :first_name,
            :last_name,
            :email,
            :email_normalized,
            :phone,
            :phone_normalized,
            :badge_type,
            :created_at,
            :checked_in_at
        )'
    );

    $statement->execute([
        ':id' => $member['id'],
        ':first_name' => $member['firstName'],
        ':last_name' => $member['lastName'],
        ':email' => $member['email'],
        ':email_normalized' => normalize_email($member['email']),
        ':phone' => $member['phone'],
        ':phone_normalized' => normalize_phone($member['phone']),
        ':badge_type' => $member['badgeType'],
        ':created_at' => $member['createdAt'],
        ':checked_in_at' => null,
    ]);

    return $member;
}

function create_professor(array $payload): array
{
    $now = gmdate('c');
    $primaryEmail = trim((string) ($payload['primaryEmail'] ?? ''));
    $secondaryEmail = trim((string) ($payload['secondaryEmail'] ?? ''));
    $professor = [
        'id' => bin2hex(random_bytes(8)),
        'name' => trim((string) ($payload['name'] ?? '')),
        'primaryEmail' => $primaryEmail,
        'secondaryEmail' => $secondaryEmail !== '' ? $secondaryEmail : null,
        'createdAt' => $now,
    ];

    $statement = database()->prepare(
        'INSERT INTO professors (
            id,
            name,
            primary_email,
            primary_email_normalized,
            secondary_email,
            secondary_email_normalized,
            created_at
        ) VALUES (
            :id,
            :name,
            :primary_email,
            :primary_email_normalized,
            :secondary_email,
            :secondary_email_normalized,
            :created_at
        )'
    );

    $statement->execute([
        ':id' => $professor['id'],
        ':name' => $professor['name'],
        ':primary_email' => $professor['primaryEmail'],
        ':primary_email_normalized' => normalize_email($professor['primaryEmail']),
        ':secondary_email' => $professor['secondaryEmail'],
        ':secondary_email_normalized' => $professor['secondaryEmail'] !== null
            ? normalize_email($professor['secondaryEmail'])
            : null,
        ':created_at' => $professor['createdAt'],
    ]);

    return $professor;
}

function delete_committee_member(string $memberId): bool
{
    $statement = database()->prepare('DELETE FROM committee_members WHERE id = :id');
    $statement->execute([':id' => $memberId]);

    return $statement->rowCount() > 0;
}

function delete_professor(string $professorId): bool
{
    $statement = database()->prepare('DELETE FROM professors WHERE id = :id');
    $statement->execute([':id' => $professorId]);

    return $statement->rowCount() > 0;
}

function build_committee_member_qr_value(string $memberId): string
{
    return '3D-IMPACT-COMMITTEE:' . strtoupper(trim($memberId));
}

function find_committee_member_by_qr_payload(string $payload): ?array
{
    $trimmedPayload = trim($payload);

    if ($trimmedPayload === '') {
        return null;
    }

    $normalizedPayload = strtoupper($trimmedPayload);
    $prefix = '3D-IMPACT-COMMITTEE:';

    if (str_starts_with($normalizedPayload, $prefix)) {
        $memberId = substr($trimmedPayload, strlen($prefix));
        return find_committee_member_by_id($memberId);
    }

    return find_committee_member_by_id($trimmedPayload);
}

function mark_committee_member_checked_in(string $memberId): ?array
{
    $connection = database();
    begin_immediate_transaction($connection);

    try {
        $member = find_committee_member_by_id($memberId);

        if ($member === null) {
            $connection->commit();
            return null;
        }

        if ($member['checkedInAt'] !== null) {
            $connection->commit();
            return $member;
        }

        if ((get_jourj_snapshot()['isCapacityReached'] ?? false) === true) {
            $connection->rollBack();
            respond([
                'ok' => false,
                'message' => "Capacite maximale atteinte. Aucun nouveau check-in ne peut etre enregistre.",
            ], 409);
        }

        $checkedInAt = gmdate('c');
        $statement = $connection->prepare(
            'UPDATE committee_members
             SET checked_in_at = :checked_in_at
             WHERE id = :id'
        );
        $statement->execute([
            ':checked_in_at' => $checkedInAt,
            ':id' => $memberId,
        ]);

        $updatedMember = find_committee_member_by_id($memberId);
        $connection->commit();

        return $updatedMember;
    } catch (Throwable $exception) {
        if ($connection->inTransaction()) {
            $connection->rollBack();
        }

        throw $exception;
    }
}

function clear_committee_member_checked_in(string $memberId): ?array
{
    $member = find_committee_member_by_id($memberId);

    if ($member === null) {
        return null;
    }

    if ($member['checkedInAt'] === null) {
        return $member;
    }

    $statement = database()->prepare(
        'UPDATE committee_members
         SET checked_in_at = NULL
         WHERE id = :id'
    );
    $statement->execute([
        ':id' => $memberId,
    ]);

    return find_committee_member_by_id($memberId);
}

function authenticate_committee_user(string $email, string $password): ?array
{
    $row = find_committee_user_row_by_email($email);

    if ($row === null || ((int) $row['is_active']) !== 1) {
        return null;
    }

    if (!password_verify($password, (string) $row['password_hash'])) {
        return null;
    }

    $lastLoginAt = gmdate('c');
    $statement = database()->prepare(
        'UPDATE committee_users
         SET last_login_at = :last_login_at
         WHERE id = :id'
    );
    $statement->execute([
        ':last_login_at' => $lastLoginAt,
        ':id' => (string) $row['id'],
    ]);

    $row['last_login_at'] = $lastLoginAt;

    return committee_user_from_row($row);
}

function get_setting(string $key, string $fallback): string
{
    $statement = database()->prepare('SELECT value FROM settings WHERE key = :key LIMIT 1');
    $statement->execute([':key' => $key]);
    $value = $statement->fetchColumn();

    if ($value === false) {
        return $fallback;
    }

    return (string) $value;
}

function set_setting(string $key, string $value): void
{
    $statement = database()->prepare(
        'INSERT INTO settings (key, value)
         VALUES (:key, :value)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value'
    );
    $statement->execute([
        ':key' => $key,
        ':value' => $value,
    ]);
}

function get_external_ticket_price(): int
{
    $value = (int) get_setting('external_ticket_price', (string) DEFAULT_EXTERNAL_TICKET_PRICE);
    return $value >= 0 ? $value : DEFAULT_EXTERNAL_TICKET_PRICE;
}

function is_registration_closed(): bool
{
    $value = get_setting('is_registration_closed', '0');
    return $value === '1';
}

function get_max_inside_capacity(): ?int
{
    $value = trim(get_setting('max_inside_capacity', ''));

    if ($value === '') {
        return null;
    }

    $parsedValue = (int) $value;

    return $parsedValue > 0 ? $parsedValue : null;
}

function set_max_inside_capacity(?int $value): ?int
{
    set_setting('max_inside_capacity', $value !== null && $value > 0 ? (string) $value : '');
    return get_max_inside_capacity();
}

function get_jourj_manual_adjustment(): int
{
    return (int) get_setting('jourj_manual_adjustment', '0');
}

function set_jourj_manual_adjustment(int $value): int
{
    set_setting('jourj_manual_adjustment', (string) $value);
    return $value;
}

function increment_jourj_manual_adjustment(int $delta): int
{
    $connection = database();
    $connection->beginTransaction();

    try {
        $nextValue = get_jourj_manual_adjustment() + $delta;
        set_jourj_manual_adjustment($nextValue);
        $connection->commit();
        return $nextValue;
    } catch (Throwable $exception) {
        if ($connection->inTransaction()) {
            $connection->rollBack();
        }

        throw $exception;
    }
}

function get_jourj_snapshot(): array
{
    $participantPresentCount = count_present_participants();
    $committeePresentCount = count_present_committee_members();
    $checkedInCount = $participantPresentCount + $committeePresentCount;
    $manualAdjustment = get_jourj_manual_adjustment();
    $maxInsideCapacity = get_max_inside_capacity();
    $insideCount = max(0, $checkedInCount + $manualAdjustment);

    return [
        'participantPresentCount' => $participantPresentCount,
        'committeePresentCount' => $committeePresentCount,
        'checkedInCount' => $checkedInCount,
        'manualAdjustment' => $manualAdjustment,
        'insideCount' => $insideCount,
        'maxInsideCapacity' => $maxInsideCapacity,
        'isCapacityReached' => $maxInsideCapacity !== null && $insideCount >= $maxInsideCapacity,
        'updatedAt' => gmdate('c'),
    ];
}

function abort_if_max_inside_capacity_reached(): void
{
    $snapshot = get_jourj_snapshot();

    if (($snapshot['isCapacityReached'] ?? false) !== true) {
        return;
    }

    respond([
        'ok' => false,
        'message' => 'Capacité maximale atteinte. Aucun nouveau check-in ne peut être enregistré.',
    ], 409);
}
