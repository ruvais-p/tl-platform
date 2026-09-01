<?php
// Streams local concept videos with byte-range support so browser video controls can seek.
require_once(__DIR__ . '/../../config.php');

require_login();
$context = context_system::instance();
require_capability('local/tella_workshop:view', $context);

$files = [
    'lpp.mp4' => __DIR__ . '/media/lpp.mp4',
    'multi.mp4' => __DIR__ . '/media/multi.mp4',
];
$name = required_param('file', PARAM_FILE);
if (!array_key_exists($name, $files) || !is_readable($files[$name])) {
    throw new moodle_exception('filenotfound', 'error');
}

$path = $files[$name];
$size = filesize($path);
$start = 0;
$end = $size - 1;
$status = 200;

if (!empty($_SERVER['HTTP_RANGE']) && preg_match('/bytes=(\d*)-(\d*)/', $_SERVER['HTTP_RANGE'], $matches)) {
    if ($matches[1] !== '') {
        $start = (int) $matches[1];
    }
    if ($matches[2] !== '') {
        $end = (int) $matches[2];
    }
    if ($matches[1] === '' && $matches[2] !== '') {
        $start = max(0, $size - (int) $matches[2]);
    }
    if ($start > $end || $start >= $size) {
        header('Content-Range: bytes */' . $size);
        http_response_code(416);
        exit;
    }
    $end = min($end, $size - 1);
    $status = 206;
}

while (ob_get_level()) {
    ob_end_clean();
}
session_write_close();
http_response_code($status);
header('Content-Type: video/mp4');
header('Accept-Ranges: bytes');
header('Content-Length: ' . ($end - $start + 1));
if ($status === 206) {
    header('Content-Range: bytes ' . $start . '-' . $end . '/' . $size);
}

$handle = fopen($path, 'rb');
fseek($handle, $start);
$remaining = $end - $start + 1;
while ($remaining > 0 && !feof($handle)) {
    $chunk = fread($handle, min(8192, $remaining));
    if ($chunk === false) {
        break;
    }
    echo $chunk;
    $remaining -= strlen($chunk);
    flush();
}
fclose($handle);
exit;
