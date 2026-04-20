<?php
declare(strict_types=1);

require __DIR__ . '/_bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    respond([
        'ok' => true,
        ...get_jourj_snapshot(),
    ]);
}

$payload = read_json_body();
$delta = $payload['delta'] ?? null;

if (!is_int($delta) && !(is_string($delta) && preg_match('/^[+-]?\d+$/', trim($delta)) === 1)) {
    respond([
        'ok' => false,
        'message' => 'Variation Jour J invalide.',
    ], 422);
}

$parsedDelta = (int) $delta;

if ($parsedDelta !== 0) {
    increment_jourj_manual_adjustment($parsedDelta);
}

respond([
    'ok' => true,
    ...get_jourj_snapshot(),
]);
