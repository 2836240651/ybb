<?php
/**
 * Inspect / restore WP active_plugins. ?key=ybb-migrate-20260624
 * POST restore=1 to apply (uses backup option or reinstall-all-safe list).
 */
require __DIR__ . '/wp-load.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

$key = 'ybb-migrate-20260624';
if (($_GET['key'] ?? $_POST['key'] ?? '') !== $key) {
    http_response_code(403);
    echo json_encode(['error' => 'forbidden']);
    exit;
}

if (!function_exists('get_plugins')) {
    require_once ABSPATH . 'wp-admin/includes/plugin.php';
}

$pluginsDir = WP_CONTENT_DIR . '/plugins';
$disabledDir = WP_CONTENT_DIR . '/.plugins';

$active = (array) get_option('active_plugins', []);
$all = get_plugins();

// SiteGround / common backup option names
$backupKeys = [
    'active_plugins_backup',
    'sg_active_plugins',
    'sg_disabled_plugins',
    'siteground_disabled_plugins',
    'jetpack_active_plugins_backup',
    'recovery_mode_plugins',
];
$backups = [];
foreach ($backupKeys as $bk) {
    $val = get_option($bk, null);
    if ($val !== null && $val !== false && $val !== '') {
        $backups[$bk] = $val;
    }
}

// Autoload options containing plugin lists
global $wpdb;
$likeRows = $wpdb->get_results(
    "SELECT option_name, option_value FROM {$wpdb->options}
     WHERE option_name LIKE '%plugin%' AND option_name NOT LIKE '%_transient_%'
     ORDER BY option_name LIMIT 200",
    ARRAY_A
);
$candidates = [];
foreach ($likeRows as $row) {
    $val = maybe_unserialize($row['option_value']);
    if (is_array($val) && $val !== [] && array_is_list($val)) {
        $first = (string) ($val[0] ?? '');
        if (str_contains($first, '/') && str_ends_with($first, '.php')) {
            $candidates[$row['option_name']] = $val;
        }
    }
}

$restoreList = null;
$restoreSource = null;

// Prefer explicit backups with many plugins
foreach ($candidates as $name => $list) {
    if (count($list) >= 3 && (str_contains($name, 'backup') || str_contains($name, 'disabled') || str_contains($name, 'sg_'))) {
        if ($restoreList === null || count($list) > count($restoreList)) {
            $restoreList = $list;
            $restoreSource = $name;
        }
    }
}

// Fallback: activate all installed except known troublemakers
$safeActivateAll = array_keys($all);
$exclude = [
    'hello.php', // not real
];
$safeActivateAll = array_values(array_filter($safeActivateAll, static function ($file) use ($exclude, $all) {
    if (!isset($all[$file])) {
        return false;
    }
    $slug = dirname($file);
    if ($slug === '.') {
        return true;
    }
    return true;
}));

if ($_SERVER['REQUEST_METHOD'] === 'POST' && !empty($_POST['restore'])) {
    $mode = sanitize_key($_POST['mode'] ?? 'backup');
    $target = [];

    if ($mode === 'backup' && is_array($restoreList) && $restoreList !== []) {
        $target = $restoreList;
        $restoreSource = $restoreSource ?: 'candidate_backup';
    } elseif ($mode === 'all') {
        $target = $safeActivateAll;
        $restoreSource = 'activate_all_installed';
    } else {
        http_response_code(400);
        echo json_encode(['error' => 'no_backup_found', 'candidates' => array_keys($candidates)]);
        exit;
    }

    // Only plugins that exist on disk
    $valid = [];
    foreach ($target as $file) {
        $file = (string) $file;
        if (isset($all[$file])) {
            $valid[] = $file;
        }
    }
    $valid = array_values(array_unique($valid));

    update_option('active_plugins', $valid, true);

    // Network plugins if multisite (not expected)
    if (is_multisite()) {
        $network = (array) get_site_option('active_sitewide_plugins', []);
        // leave as-is
    }

    // Rename .plugins back if SG disabled that way
    $renamedBack = false;
    if (is_dir($disabledDir) && !is_dir($pluginsDir)) {
        @rename($disabledDir, $pluginsDir);
        $renamedBack = is_dir($pluginsDir);
    }

    if (function_exists('opcache_reset')) {
        @opcache_reset();
    }

    echo json_encode([
        'ok' => true,
        'source' => $restoreSource,
        'activatedCount' => count($valid),
        'activated' => $valid,
        'renamedPluginsDirBack' => $renamedBack,
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

echo json_encode([
    'site' => home_url(),
    'pluginsDirExists' => is_dir($pluginsDir),
    'disabledDirExists' => is_dir($disabledDir),
    'activeCount' => count($active),
    'activePlugins' => $active,
    'installedCount' => count($all),
    'allPluginFiles' => array_keys($all),
    'backupOptions' => $backups,
    'candidateLists' => array_map(static fn($l) => ['count' => count($l), 'sample' => array_slice($l, 0, 5)], $candidates),
    'bestRestoreCandidate' => $restoreSource,
    'bestRestoreCount' => is_array($restoreList) ? count($restoreList) : 0,
    'bestRestoreSample' => is_array($restoreList) ? array_slice($restoreList, 0, 10) : [],
], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
