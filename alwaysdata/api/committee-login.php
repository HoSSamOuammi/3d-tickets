<?php
declare(strict_types=1);

require __DIR__ . '/_bootstrap.php';

$payload = read_json_body();
$email = trim((string) ($payload['email'] ?? ''));
$password = (string) ($payload['password'] ?? '');

if ($email === '' || $password === '') {
    respond([
        'ok' => false,
        'message' => 'Email et mot de passe requis.',
    ], 422);
}

if (filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
    respond([
        'ok' => false,
        'message' => 'Adresse email invalide.',
    ], 422);
}

if (verify_check_in_credentials($email, $password)) {
    $_SESSION['check_in_authenticated'] = true;
    $_SESSION['check_in_user_id'] = '__fallback_checkin__';

    respond([
        'ok' => true,
        'authenticated' => true,
        'user' => null,
    ]);
}

$committeeUser = authenticate_committee_user($email, $password);

if ($committeeUser === null) {
    respond([
        'ok' => true,
        'authenticated' => false,
    ]);
}

$_SESSION['check_in_authenticated'] = true;
$_SESSION['check_in_user_id'] = $committeeUser['id'];

respond([
    'ok' => true,
    'authenticated' => true,
    'user' => $committeeUser,
]);
