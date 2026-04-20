<?php
declare(strict_types=1);

require __DIR__ . '/_bootstrap.php';

require_admin();

$payload = read_json_body();
$action = (string) ($payload['action'] ?? '');
$participantId = trim((string) ($payload['participantId'] ?? ''));
$present = ($payload['present'] ?? false) === true;

if ($action !== 'set_presence') {
    respond([
        'ok' => false,
        'message' => 'Action admin participants invalide.',
    ], 422);
}

if ($participantId === '') {
    respond([
        'ok' => false,
        'message' => 'Participant introuvable.',
    ], 422);
}

$participant = $present
    ? mark_participant_checked_in($participantId)
    : clear_participant_checked_in($participantId);

if ($participant === null) {
    respond([
        'ok' => false,
        'message' => 'Participant introuvable.',
    ], 404);
}

respond([
    'ok' => true,
    'participant' => $participant,
    'registrants' => list_participants(),
]);
