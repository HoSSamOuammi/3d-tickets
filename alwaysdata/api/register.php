<?php
declare(strict_types=1);

require __DIR__ . '/_bootstrap.php';

check_rate_limit('register', get_client_ip(), 10, 3600);

$payload = read_json_body();

if (is_registration_closed()) {
    respond([
        'ok' => false,
        'message' => "Le quota de places disponibles ayant été atteint, les inscriptions en ligne sont désormais clôturées. Un accès sur place pourra toutefois être envisagé le jour J, dans la limite des places disponibles. Les participants déjà munis d'un ticket seront accueillis en priorité. Nous vous remercions pour votre compréhension.",
    ], 403);
}

$firstName = trim((string) ($payload['firstName'] ?? ''));
$lastName = trim((string) ($payload['lastName'] ?? ''));
$email = trim((string) ($payload['email'] ?? ''));
$phone = trim((string) ($payload['phone'] ?? ''));
$type = ($payload['type'] ?? 'internal') === 'external' ? 'external' : 'internal';

if (strlen($firstName) > 100 || strlen($lastName) > 100 || strlen($email) > 255 || strlen($phone) > 50) {
    respond([
        'ok' => false,
        'message' => 'Les données saisies sont trop longues.',
    ], 422);
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
        'message' => "Cette adresse email ou ce numero de telephone est deja utilise par un membre du comite. Un participant ne peut pas aussi faire partie du comite.",
    ], 409);
}

if ($emailMatch !== null && $phoneMatch !== null && $emailMatch['id'] !== $phoneMatch['id']) {
    respond([
        'ok' => false,
        'message' => "Cette adresse email et ce numero de telephone correspondent deja a deux inscriptions differentes. Merci de contacter l'equipe organisatrice.",
    ], 409);
}

$existingParticipant = $emailMatch ?? $phoneMatch;

if ($existingParticipant !== null) {
    $duplicateMatchType = ($emailMatch !== null && $phoneMatch !== null)
        ? 'email_phone'
        : ($emailMatch !== null ? 'email' : 'phone');

    respond([
        'ok' => true,
        'mode' => 'duplicate',
        'participant' => $existingParticipant,
        'duplicateMatchType' => $duplicateMatchType,
        'externalTicketPrice' => get_external_ticket_price(),
    ]);
}

$participant = create_participant([
    'firstName' => $firstName,
    'lastName' => $lastName,
    'email' => $email,
    'phone' => $phone,
    'type' => $type,
    'photo' => trim((string) ($payload['photo'] ?? '')),
]);

respond([
    'ok' => true,
    'mode' => 'created',
    'participant' => $participant,
    'externalTicketPrice' => get_external_ticket_price(),
]);
