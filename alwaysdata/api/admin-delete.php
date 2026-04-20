<?php
declare(strict_types=1);

require __DIR__ . '/_bootstrap.php';

require_admin();

$payload = read_json_body();
$participantId = trim((string) ($payload['participantId'] ?? ''));
$password = (string) ($payload['password'] ?? '');

if (!verify_admin_delete_password($password)) {
    respond([
        'ok' => false,
        'result' => 'invalid_password',
    ], 403);
}

if ($participantId === '') {
    respond([
        'ok' => false,
        'result' => 'not_found',
    ], 404);
}

if (!delete_participant($participantId)) {
    respond([
        'ok' => false,
        'result' => 'not_found',
    ], 404);
}

respond([
    'ok' => true,
    'result' => 'deleted',
    'registrants' => list_participants(),
]);

