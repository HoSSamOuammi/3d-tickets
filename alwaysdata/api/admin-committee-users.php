<?php
declare(strict_types=1);

require __DIR__ . '/_bootstrap.php';

require_admin();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    respond([
        'ok' => true,
        'committeeUsers' => list_committee_users(),
    ]);
}

$payload = read_json_body();
$action = (string) ($payload['action'] ?? '');

if ($action === 'create') {
    $name = trim((string) ($payload['name'] ?? ''));
    $email = trim((string) ($payload['email'] ?? ''));
    $password = (string) ($payload['password'] ?? '');

    if ($name === '' || $email === '' || $password === '') {
        respond([
            'ok' => false,
            'message' => 'Nom, email et mot de passe requis.',
        ], 422);
    }

    if (filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
        respond([
            'ok' => false,
            'message' => 'Adresse email invalide.',
        ], 422);
    }

    if (find_committee_user_row_by_email($email) !== null) {
        respond([
            'ok' => false,
            'message' => 'Cette adresse email est déjà utilisée par un utilisateur comité.',
        ], 409);
    }

    $committeeMember = find_committee_member_by_contact($email);

    if ($committeeMember === null) {
        respond([
            'ok' => false,
            'message' => "Un compte check-in doit etre cree a partir d'un membre du comite existant.",
        ], 409);
    }

    create_committee_user($payload);

    respond([
        'ok' => true,
        'committeeUsers' => list_committee_users(),
    ]);
}

if ($action === 'update') {
    $userId = trim((string) ($payload['userId'] ?? ''));
    $name = trim((string) ($payload['name'] ?? ''));
    $email = trim((string) ($payload['email'] ?? ''));

    if ($userId === '' || $name === '' || $email === '') {
        respond([
            'ok' => false,
            'message' => 'Identifiant, nom et email requis.',
        ], 422);
    }

    if (filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
        respond([
            'ok' => false,
            'message' => 'Adresse email invalide.',
        ], 422);
    }

    $emailOwner = find_committee_user_row_by_email($email);

    if ($emailOwner !== null && (string) $emailOwner['id'] !== $userId) {
        respond([
            'ok' => false,
            'message' => 'Cette adresse email est déjà utilisée par un autre utilisateur comité.',
        ], 409);
    }

    if (update_committee_user($userId, $payload) === null) {
        respond([
            'ok' => false,
            'message' => 'Utilisateur comité introuvable.',
        ], 404);
    }

    respond([
        'ok' => true,
        'committeeUsers' => list_committee_users(),
    ]);
}

if ($action === 'set_access') {
    $userId = trim((string) ($payload['userId'] ?? ''));
    $isActive = ($payload['isActive'] ?? null) === true;

    if ($userId === '') {
        respond([
            'ok' => false,
            'message' => 'Utilisateur comité introuvable.',
        ], 422);
    }

    if (set_committee_user_access($userId, $isActive) === null) {
        respond([
            'ok' => false,
            'message' => 'Utilisateur comité introuvable.',
        ], 404);
    }

    respond([
        'ok' => true,
        'committeeUsers' => list_committee_users(),
    ]);
}

if ($action === 'delete') {
    $userId = trim((string) ($payload['userId'] ?? ''));

    if ($userId === '') {
        respond([
            'ok' => false,
            'message' => 'Utilisateur comité introuvable.',
        ], 422);
    }

    if (!delete_committee_user($userId)) {
        respond([
            'ok' => false,
            'message' => 'Utilisateur comité introuvable.',
        ], 404);
    }

    respond([
        'ok' => true,
        'committeeUsers' => list_committee_users(),
    ]);
}

respond([
    'ok' => false,
    'message' => 'Action admin comité inconnue.',
], 400);
