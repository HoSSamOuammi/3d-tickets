<?php
declare(strict_types=1);

require __DIR__ . '/_bootstrap.php';

require_admin();

$payload = read_json_body();
$mode = ($payload['mode'] ?? 'qr') === 'contact' ? 'contact' : 'qr';
$query = trim((string) ($payload['query'] ?? ''));

if ($query === '') {
    respond([
        'ok' => false,
        'message' => $mode === 'contact'
            ? 'Veuillez saisir un email ou un numero de telephone.'
            : 'Veuillez scanner un QR code valide.',
    ], 422);
}

$participant = null;
$committeeMember = null;

if ($mode === 'contact') {
    $committeeMember = find_committee_member_by_contact($query);
    $participant = find_participant_by_contact($query);

    if ($committeeMember !== null && $participant !== null) {
        respond([
            'ok' => false,
            'message' => "Ce contact correspond a la fois a un participant et a un membre du comite. Corrigez les donnees avant de marquer la presence.",
        ], 409);
    }
} else {
    $committeeMember = find_committee_member_by_qr_payload($query);

    if ($committeeMember === null) {
        $participant = find_participant_by_ticket_id($query);
    }
}

if ($committeeMember !== null) {
    if ($committeeMember['checkedInAt'] !== null) {
        respond([
            'ok' => true,
            'found' => true,
            'entityType' => 'committee_member',
            'committeeMember' => $committeeMember,
            'presenceRecorded' => false,
            'alreadyPresent' => true,
            'registrants' => list_participants(),
            'committeeMembers' => list_committee_members(),
        ]);
    }

    $updatedMember = mark_committee_member_checked_in((string) $committeeMember['id']);

    respond([
        'ok' => true,
        'found' => true,
        'entityType' => 'committee_member',
        'committeeMember' => $updatedMember,
        'presenceRecorded' => true,
        'alreadyPresent' => false,
        'registrants' => list_participants(),
        'committeeMembers' => list_committee_members(),
    ]);
}

if ($participant !== null) {
    if ($participant['checkedInAt'] !== null) {
        respond([
            'ok' => true,
            'found' => true,
            'entityType' => 'participant',
            'participant' => $participant,
            'presenceRecorded' => false,
            'alreadyPresent' => true,
            'registrants' => list_participants(),
            'committeeMembers' => list_committee_members(),
        ]);
    }

    $updatedParticipant = mark_participant_checked_in((string) $participant['id']);

    respond([
        'ok' => true,
        'found' => true,
        'entityType' => 'participant',
        'participant' => $updatedParticipant,
        'presenceRecorded' => true,
        'alreadyPresent' => false,
        'registrants' => list_participants(),
        'committeeMembers' => list_committee_members(),
    ]);
}

respond([
    'ok' => true,
    'found' => false,
    'entityType' => null,
    'registrants' => list_participants(),
    'committeeMembers' => list_committee_members(),
]);
