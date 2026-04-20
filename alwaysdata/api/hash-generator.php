<?php
declare(strict_types=1);

if (php_sapi_name() !== 'cli' && !isset($_GET['generate'])) {
    // Basic protection to only run via CLI or with a specific parameter
    echo "This is a utility script. Run via CLI or append '?generate=YOUR_PASSWORD' to the URL.";
    exit;
}

$password = '';
if (php_sapi_name() === 'cli') {
    if (count($argv) < 2) {
        echo "Usage: php hash-generator.php YOUR_PASSWORD\n";
        exit(1);
    }
    $password = $argv[1];
} else if (isset($_GET['generate'])) {
    $password = $_GET['generate'];
}

$hash = password_hash($password, PASSWORD_BCRYPT);
echo "Password: " . htmlspecialchars($password) . "\n";
echo "Bcrypt Hash: " . $hash . "\n";
echo "\nReplace the SHA-256 hashes in your configuration with this Bcrypt hash.\n";
