<?php
declare(strict_types=1);

require __DIR__ . '/_bootstrap.php';

require_admin();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    respond([
        'ok' => true,
        'professors' => list_professors(),
    ]);
}

$payload = read_json_body();
$action = (string) ($payload['action'] ?? '');

if ($action === 'create') {
    $name = trim((string) ($payload['name'] ?? ''));
    $primaryEmail = trim((string) ($payload['primaryEmail'] ?? ''));
    $secondaryEmail = trim((string) ($payload['secondaryEmail'] ?? ''));

    if ($name === '' || $primaryEmail === '') {
        respond([
            'ok' => false,
            'message' => 'Nom et email principal requis.',
        ], 422);
    }

    if (filter_var($primaryEmail, FILTER_VALIDATE_EMAIL) === false) {
        respond([
            'ok' => false,
            'message' => 'Adresse email principale invalide.',
        ], 422);
    }

    if ($secondaryEmail !== '' && filter_var($secondaryEmail, FILTER_VALIDATE_EMAIL) === false) {
        respond([
            'ok' => false,
            'message' => 'Adresse email secondaire invalide.',
        ], 422);
    }

    $emails = array_values(array_unique(array_filter([$primaryEmail, $secondaryEmail])));

    foreach ($emails as $email) {
        if (find_professor_row_by_email($email) !== null) {
            respond([
                'ok' => false,
                'message' => 'Cette adresse email est déjà utilisée par un professeur.',
            ], 409);
        }
    }

    create_professor([
        'name' => $name,
        'primaryEmail' => $primaryEmail,
        'secondaryEmail' => $secondaryEmail,
    ]);

    respond([
        'ok' => true,
        'professors' => list_professors(),
    ]);
}

if ($action === 'import') {
    $professors = $payload['professors'] ?? null;

    if (!is_array($professors) || $professors === []) {
        respond([
            'ok' => false,
            'message' => 'Aucun professeur à importer.',
        ], 422);
    }

    $importedCount = 0;
    $skippedCount = 0;

    foreach ($professors as $professor) {
        if (!is_array($professor)) {
            $skippedCount += 1;
            continue;
        }

        $name = trim((string) ($professor['name'] ?? ''));
        $primaryEmail = trim((string) ($professor['primaryEmail'] ?? ''));
        $secondaryEmail = trim((string) ($professor['secondaryEmail'] ?? ''));

        if ($name === '' || $primaryEmail === '') {
            $skippedCount += 1;
            continue;
        }

        if (filter_var($primaryEmail, FILTER_VALIDATE_EMAIL) === false) {
            $skippedCount += 1;
            continue;
        }

        if ($secondaryEmail !== '' && filter_var($secondaryEmail, FILTER_VALIDATE_EMAIL) === false) {
            $skippedCount += 1;
            continue;
        }

        $emails = array_values(array_unique(array_filter([$primaryEmail, $secondaryEmail])));
        $isDuplicate = false;

        foreach ($emails as $email) {
            if (find_professor_row_by_email($email) !== null) {
                $isDuplicate = true;
                break;
            }
        }

        if ($isDuplicate) {
            $skippedCount += 1;
            continue;
        }

        create_professor([
            'name' => $name,
            'primaryEmail' => $primaryEmail,
            'secondaryEmail' => $secondaryEmail,
        ]);
        $importedCount += 1;
    }

    respond([
        'ok' => true,
        'professors' => list_professors(),
        'importedCount' => $importedCount,
        'skippedCount' => $skippedCount,
    ]);
}

if ($action === 'delete') {
    $professorId = trim((string) ($payload['professorId'] ?? ''));

    if ($professorId === '') {
        respond([
            'ok' => false,
            'message' => 'Professeur introuvable.',
        ], 422);
    }

    if (!delete_professor($professorId)) {
        respond([
            'ok' => false,
            'message' => 'Professeur introuvable.',
        ], 404);
    }

    respond([
        'ok' => true,
        'professors' => list_professors(),
    ]);
}

respond([
    'ok' => false,
    'message' => 'Action professeur inconnue.',
], 400);
