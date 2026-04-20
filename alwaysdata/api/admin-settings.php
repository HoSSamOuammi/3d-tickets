<?php
declare(strict_types=1);

require __DIR__ . '/_bootstrap.php';

require_admin();

$payload = read_json_body();
$hasExternalTicketPrice = array_key_exists('externalTicketPrice', $payload);
$hasRegistrationClosed = array_key_exists('isRegistrationClosed', $payload);
$hasMaxInsideCapacity = array_key_exists('maxInsideCapacity', $payload);
$externalTicketPrice = $payload['externalTicketPrice'] ?? null;
$isRegistrationClosed = $payload['isRegistrationClosed'] ?? null;
$maxInsideCapacity = $payload['maxInsideCapacity'] ?? null;

if (!$hasExternalTicketPrice && !$hasRegistrationClosed && !$hasMaxInsideCapacity) {
    respond([
        'ok' => false,
        'message' => 'Aucun paramètre admin à mettre à jour.',
    ], 422);
}

if (
    $hasExternalTicketPrice &&
    ($externalTicketPrice === null || !is_numeric($externalTicketPrice) || (int) $externalTicketPrice < 0)
) {
    respond([
        'ok' => false,
        'message' => 'Prix externe invalide.',
    ], 422);
}

if ($hasRegistrationClosed && !is_bool($isRegistrationClosed)) {
    respond([
        'ok' => false,
        'message' => 'État de fermeture invalide.',
    ], 422);
}

if (
    $hasMaxInsideCapacity &&
    $maxInsideCapacity !== null &&
    (!is_numeric($maxInsideCapacity) || (int) $maxInsideCapacity <= 0)
) {
    respond([
        'ok' => false,
        'message' => 'Capacité maximale invalide.',
    ], 422);
}

if ($hasExternalTicketPrice) {
    set_setting('external_ticket_price', (string) ((int) $externalTicketPrice));
}

if ($hasRegistrationClosed) {
    set_setting('is_registration_closed', $isRegistrationClosed ? '1' : '0');
}

if ($hasMaxInsideCapacity) {
    set_max_inside_capacity($maxInsideCapacity !== null ? (int) $maxInsideCapacity : null);
}

respond([
    'ok' => true,
    'externalTicketPrice' => get_external_ticket_price(),
    'isRegistrationClosed' => is_registration_closed(),
    'maxInsideCapacity' => get_max_inside_capacity(),
]);
