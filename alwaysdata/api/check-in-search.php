<?php
declare(strict_types=1);

require __DIR__ . '/_bootstrap.php';

require_check_in();

$payload = read_json_body();
$mode = ($payload['mode'] ?? 'ticket') === 'contact' ? 'contact' : 'ticket';
$query = trim((string) ($payload['query'] ?? ''));

if ($query === '') {
    respond([
        'ok' => false,
        'message' => 'Recherche vide.',
    ], 422);
}

$participant = $mode === 'contact'
    ? find_participant_by_contact($query)
    : find_participant_by_ticket_id($query);

$presenceRecorded = false;
$alreadyPresent = false;

if ($participant !== null) {
    if ($participant['checkedInAt'] !== null) {
        $alreadyPresent = true;
    } else {
        $updatedParticipant = mark_participant_checked_in((string) $participant['id']);

        if ($updatedParticipant !== null) {
            $participant = $updatedParticipant;
            $presenceRecorded = true;
        }
    }
}

respond([
    'ok' => true,
    'found' => $participant !== null,
    'participant' => $participant,
    'presenceRecorded' => $presenceRecorded,
    'alreadyPresent' => $alreadyPresent,
]);
