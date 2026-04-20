<?php
declare(strict_types=1);

require __DIR__ . '/_bootstrap.php';

unset($_SESSION['check_in_authenticated']);
unset($_SESSION['check_in_user_id']);

respond([
    'ok' => true,
]);
