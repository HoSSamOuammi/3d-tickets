<?php
declare(strict_types=1);

require __DIR__ . '/_bootstrap.php';

$payload = read_json_body();
$id = trim((string) ($payload['id'] ?? ''));
$firstName = trim((string) ($payload['firstName'] ?? ''));
$lastName = trim((string) ($payload['lastName'] ?? ''));
$email = trim((string) ($payload['email'] ?? ''));
$phone = trim((string) ($payload['phone'] ?? ''));
$type = ($payload['type'] ?? 'internal') === 'external' ? 'external' : 'internal';

if ($id === '') {
    respond([
        'ok' => false,
        'message' => 'Identifiant manquant.',
    ], 400);
}

if ($firstName === '' || $lastName === '' || $email === '' || $phone === '') {
    respond([
        'ok' => false,
        'message' => 'Veuillez remplir tous les champs obligatoires.',
    ], 422);
}

if (filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
    respond([
        'ok' => false,
        'message' => 'Veuillez saisir une adresse email valide.',
    ], 422);
}

// Ensure the email/phone updates do not collide with another different user
$emailNormalized = normalize_email($email);
$phoneNormalized = normalize_phone($phone);
[$emailMatch, $phoneMatch] = get_duplicate_matches($emailNormalized, $phoneNormalized);
[$committeeEmailMatch, $committeePhoneMatch] = get_committee_member_duplicate_matches(
    $emailNormalized,
    $phoneNormalized
);

if ($committeeEmailMatch !== null || $committeePhoneMatch !== null) {
    respond([
        'ok' => false,
        'message' => 'Cette adresse email ou ce numéro de téléphone est déjà utilisé par un membre du comité. Un participant ne peut pas aussi faire partie du comité.',
    ], 409);
}

if ($emailMatch !== null && $emailMatch['id'] !== $id) {
    respond([
        'ok' => false,
        'message' => 'Cette adresse email est déjà utilisée par une autre inscription.',
    ], 409);
}

if ($phoneMatch !== null && $phoneMatch['id'] !== $id) {
    respond([
        'ok' => false,
        'message' => 'Ce numéro de téléphone est déjà utilisé par une autre inscription.',
    ], 409);
}

$participant = update_participant($id, current($payload) ? $payload : [
    'firstName' => $firstName,
    'lastName' => $lastName,
    'email' => $email,
    'phone' => $phone,
    'type' => $type,
    'photo' => trim((string) ($payload['photo'] ?? '')),
]);

if ($participant === null) {
    respond([
        'ok' => false,
        'message' => 'Inscription introuvable.',
    ], 404);
}

respond([
    'ok' => true,
    'mode' => 'updated',
    'participant' => $participant,
    'externalTicketPrice' => get_external_ticket_price(),
]);
