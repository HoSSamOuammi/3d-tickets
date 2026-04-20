<?php
declare(strict_types=1);

require __DIR__ . '/_bootstrap.php';

require_admin();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    respond([
        'ok' => true,
        'committeeMembers' => list_committee_members(),
    ]);
}

$payload = read_json_body();
$action = (string) ($payload['action'] ?? '');

if ($action === 'create') {
    $firstName = trim((string) ($payload['firstName'] ?? ''));
    $lastName = trim((string) ($payload['lastName'] ?? ''));
    $email = trim((string) ($payload['email'] ?? ''));
    $phone = trim((string) ($payload['phone'] ?? ''));
    $badgeType = normalize_committee_badge_type((string) ($payload['badgeType'] ?? 'committee'));

    if ($firstName === '' || $lastName === '' || $email === '') {
        respond([
            'ok' => false,
            'message' => 'Prenom, nom et email requis.',
        ], 422);
    }

    if (filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
        respond([
            'ok' => false,
            'message' => 'Adresse email invalide.',
        ], 422);
    }

    if (find_committee_member_row_by_email($email) !== null) {
        respond([
            'ok' => false,
            'message' => 'Cette adresse email est deja utilisee par un membre comite.',
        ], 409);
    }

    if ($phone !== '' && find_committee_member_row_by_phone($phone) !== null) {
        respond([
            'ok' => false,
            'message' => 'Ce numero de telephone est deja utilise par un membre comite.',
        ], 409);
    }

    [$participantEmailMatch, $participantPhoneMatch] = get_duplicate_matches(
        normalize_email($email),
        normalize_phone($phone)
    );

    if ($participantEmailMatch !== null || $participantPhoneMatch !== null) {
        respond([
            'ok' => false,
            'message' => "Cette adresse email ou ce numero de telephone est deja utilise par un participant. Un membre du comite ne peut pas aussi etre participant.",
        ], 409);
    }

    create_committee_member([
        'firstName' => $firstName,
        'lastName' => $lastName,
        'email' => $email,
        'phone' => $phone,
        'badgeType' => $badgeType,
    ]);

    respond([
        'ok' => true,
        'committeeMembers' => list_committee_members(),
    ]);
}

if ($action === 'import') {
    $members = $payload['members'] ?? null;

    if (!is_array($members) || $members === []) {
        respond([
            'ok' => false,
            'message' => 'Aucun membre comite a importer.',
        ], 422);
    }

    $importedCount = 0;
    $skippedCount = 0;

    foreach ($members as $member) {
        if (!is_array($member)) {
            $skippedCount += 1;
            continue;
        }

        $firstName = trim((string) ($member['firstName'] ?? ''));
        $lastName = trim((string) ($member['lastName'] ?? ''));
        $email = trim((string) ($member['email'] ?? ''));
        $phone = trim((string) ($member['phone'] ?? ''));
        $badgeType = normalize_committee_badge_type((string) ($member['badgeType'] ?? 'committee'));

        if ($firstName === '' || $lastName === '' || $email === '') {
            $skippedCount += 1;
            continue;
        }

        if (filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
            $skippedCount += 1;
            continue;
        }

        if (find_committee_member_row_by_email($email) !== null) {
            $skippedCount += 1;
            continue;
        }

        if ($phone !== '' && find_committee_member_row_by_phone($phone) !== null) {
            $skippedCount += 1;
            continue;
        }

        [$participantEmailMatch, $participantPhoneMatch] = get_duplicate_matches(
            normalize_email($email),
            normalize_phone($phone)
        );

        if ($participantEmailMatch !== null || $participantPhoneMatch !== null) {
            $skippedCount += 1;
            continue;
        }

        create_committee_member([
            'firstName' => $firstName,
            'lastName' => $lastName,
            'email' => $email,
            'phone' => $phone,
            'badgeType' => $badgeType,
        ]);
        $importedCount += 1;
    }

    respond([
        'ok' => true,
        'committeeMembers' => list_committee_members(),
        'importedCount' => $importedCount,
        'skippedCount' => $skippedCount,
    ]);
}

if ($action === 'delete') {
    $memberId = trim((string) ($payload['memberId'] ?? ''));

    if ($memberId === '') {
        respond([
            'ok' => false,
            'message' => 'Membre comite introuvable.',
        ], 422);
    }

    if (!delete_committee_member($memberId)) {
        respond([
            'ok' => false,
            'message' => 'Membre comite introuvable.',
        ], 404);
    }

    respond([
        'ok' => true,
        'committeeMembers' => list_committee_members(),
    ]);
}

if ($action === 'set_presence') {
    $memberId = trim((string) ($payload['memberId'] ?? ''));
    $present = (bool) ($payload['present'] ?? false);

    if ($memberId === '') {
        respond([
            'ok' => false,
            'message' => 'Membre comite introuvable.',
        ], 422);
    }

    $member = find_committee_member_by_id($memberId);

    if ($member === null) {
        respond([
            'ok' => false,
            'message' => 'Membre comite introuvable.',
        ], 404);
    }

    if ($present) {
        mark_committee_member_checked_in($memberId);
    } else {
        clear_committee_member_checked_in($memberId);
    }

    respond([
        'ok' => true,
        'committeeMembers' => list_committee_members(),
    ]);
}

if ($action === 'mark_present_by_qr') {
    $qrPayload = trim((string) ($payload['qrPayload'] ?? ''));

    if ($qrPayload === '') {
        respond([
            'ok' => false,
            'message' => 'QR code comite vide.',
        ], 422);
    }

    $member = find_committee_member_by_qr_payload($qrPayload);

    if ($member === null) {
        respond([
            'ok' => true,
            'status' => 'not_found',
            'committeeMembers' => list_committee_members(),
        ]);
    }

    if ($member['checkedInAt'] !== null) {
        respond([
            'ok' => true,
            'status' => 'already_present',
            'committeeMember' => $member,
            'committeeMembers' => list_committee_members(),
        ]);
    }

    $updatedMember = mark_committee_member_checked_in((string) $member['id']);

    respond([
        'ok' => true,
        'status' => 'marked_present',
        'committeeMember' => $updatedMember,
        'committeeMembers' => list_committee_members(),
    ]);
}

respond([
    'ok' => false,
    'message' => 'Action membre comite inconnue.',
], 400);
