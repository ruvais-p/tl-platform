<?php
$uri = urldecode(parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?? '/');

$full = __DIR__ . $uri;
if ($uri !== '/' && is_file($full)) {
    return false;
}

// The PHP built-in server delegates directory URLs to its router. Resolve these
// to the directory's index.php so Moodle links such as /my/ work normally.
if ($uri !== '/' && substr($uri, -1) === '/') {
    $scriptname = rtrim($uri, '/') . '/index.php';
    $script = __DIR__ . $scriptname;
    if (is_file($script)) {
        $_SERVER['SCRIPT_FILENAME'] = $script;
        $_SERVER['SCRIPT_NAME'] = $scriptname;
        $_SERVER['PHP_SELF'] = $scriptname;
        chdir(dirname($script));
        require $script;
        return true;
    }
}

if (preg_match('#^((?:/[^/]+)*/[^/]+\.php)(/.*)?$#', $uri, $matches)) {
    $script = __DIR__ . $matches[1];
    if (is_file($script)) {
        $_SERVER['SCRIPT_FILENAME'] = $script;
        $_SERVER['SCRIPT_NAME'] = $matches[1];
        $_SERVER['PHP_SELF'] = $matches[1];
        $_SERVER['PATH_INFO'] = $matches[2] ?? '';
        chdir(dirname($script));
        require $script;
        return true;
    }
}

$_SERVER['SCRIPT_FILENAME'] = __DIR__ . '/index.php';
$_SERVER['SCRIPT_NAME'] = '/index.php';
require __DIR__ . '/index.php';
