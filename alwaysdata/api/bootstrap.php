<?php
declare(strict_types=1);

require __DIR__ . '/_bootstrap.php';

database();

respond([
    'ok' => true,
    'mode' => 'remote',
    'adminAuthenticated' => is_admin_authenticated(),
    'checkInAuthenticated' => is_check_in_authenticated() || is_admin_authenticated(),
    'externalTicketPrice' => get_external_ticket_price(),
    'isRegistrationClosed' => is_registration_closed(),
    'maxInsideCapacity' => get_max_inside_capacity(),
    'registrants' => is_admin_authenticated() ? list_participants() : [],
    'committeeUsers' => is_admin_authenticated() ? list_committee_users() : [],
    'committeeMembers' => is_admin_authenticated() ? list_committee_members() : [],
    'professors' => is_admin_authenticated() ? list_professors() : [],
]);
