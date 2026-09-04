<?php
$uri = urldecode(parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?? '/');

$full = __DIR__ . $uri;
if ($uri !== '/' && is_file($full)) {
    return false;
}

// PHP's development server does not resolve directory index files after the
// request has fallen through to this router. Route paths such as /my/ and
// /login/ to their own index.php instead of Moodle's site-root index.php.
if ($uri !== '/' && is_dir($full)) {
    $script = rtrim($full, DIRECTORY_SEPARATOR) . '/index.php';
    if (is_file($script)) {
        $scriptname = rtrim($uri, '/') . '/index.php';
        $_SERVER['SCRIPT_FILENAME'] = $script;
        $_SERVER['SCRIPT_NAME'] = $scriptname;
        $_SERVER['PHP_SELF'] = $scriptname;
        $_SERVER['PATH_INFO'] = '';
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
