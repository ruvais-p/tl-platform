<?php
// Demo-only provisioning helper. This is not part of local_tella_workshop.
define('CLI_SCRIPT', true);
require(__DIR__ . '/../moodle/config.php');
require_once($CFG->libdir . '/clilib.php');
require_once($CFG->dirroot . '/course/lib.php');

$shortname = 'TELLA-DEMO';
$existing = $DB->get_record('course', ['shortname' => $shortname]);
if ($existing) {
    cli_writeln("Demo course already exists: {$existing->fullname} (id {$existing->id})");
    exit(0);
}

$category = $DB->get_record('course_categories', ['id' => 1], '*', MUST_EXIST);
$course = create_course((object) [
    'category' => $category->id,
    'fullname' => 'Tella Business Mathematics Demo',
    'shortname' => $shortname,
    'idnumber' => 'TELLA-DEMO',
    'summary' => 'Demo course for the Tella Workshop Moodle plugin. Explore business modelling with the bakery scenario.',
    'summaryformat' => FORMAT_HTML,
    'format' => 'topics',
    'numsections' => 4,
    'visible' => 1,
    'startdate' => time(),
]);

cli_writeln("Created demo course: {$course->fullname} (id {$course->id})");
