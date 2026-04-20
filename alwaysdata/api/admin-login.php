<?php
declare(strict_types=1);

require __DIR__ . '/_bootstrap.php';

check_rate_limit('admin_login', get_client_ip(), 15, 900);

$payload = read_json_body();

$username = trim((string) ($payload['username'] ?? ''));
$password = (string) ($payload['password'] ?? '');
$isPortalLoginAttempt = $username !== '' || $password !== '';

if ($isPortalLoginAttempt) {
    if (!verify_admin_portal_credentials($username, $password)) {
        respond([
            'ok' => true,
            'authenticated' => false,
        ]);
    }

    session_regenerate_id(true);
    $_SESSION['admin_authenticated'] = true;
    $_SESSION['check_in_authenticated'] = true;

    respond([
        'ok' => true,
        'authenticated' => true,
        'registrants' => list_participants(),
        'externalTicketPrice' => get_external_ticket_price(),
        'isRegistrationClosed' => is_registration_closed(),
        'maxInsideCapacity' => get_max_inside_capacity(),
        'committeeUsers' => list_committee_users(),
        'committeeMembers' => list_committee_members(),
        'professors' => list_professors(),
    ]);
}

if (!is_admin_access_attempt($payload)) {
    respond([
        'ok' => true,
        'authenticated' => false,
    ]);
}

session_regenerate_id(true);
$_SESSION['admin_authenticated'] = true;

respond([
    'ok' => true,
    'authenticated' => true,
    'registrants' => list_participants(),
    'externalTicketPrice' => get_external_ticket_price(),
    'isRegistrationClosed' => is_registration_closed(),
    'maxInsideCapacity' => get_max_inside_capacity(),
    'committeeUsers' => list_committee_users(),
    'committeeMembers' => list_committee_members(),
    'professors' => list_professors(),
]);
