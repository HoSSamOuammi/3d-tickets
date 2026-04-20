<?php
declare(strict_types=1);

require __DIR__ . '/_bootstrap.php';

require_admin();

$payload = read_json_body();
$participantId = trim((string) ($payload['participantId'] ?? ''));

if ($participantId === '') {
    respond([
        'ok' => false,
        'message' => 'Participant introuvable.',
    ], 422);
}

$participant = confirm_external_participant($participantId);

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

