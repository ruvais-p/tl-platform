<?php
require_once(__DIR__ . '/../../config.php');
require_once(__DIR__ . '/lib.php');

require_login();
$context = context_system::instance();
require_capability('local/tella_workshop:view', $context);

$PAGE->set_context($context);
$PAGE->set_url(new moodle_url('/local/tella_workshop/index.php'));
$PAGE->set_primary_active_tab('tella_skill_enhancement');
$PAGE->set_pagelayout('standard');
$PAGE->add_body_class('tella-workshop-page');
$PAGE->set_title(get_string('pageheading', 'local_tella_workshop'));
$PAGE->set_heading(get_string('pageheading', 'local_tella_workshop'));
$PAGE->navbar->add(get_string('navtab', 'local_tella_workshop'));
$PAGE->requires->css('/local/tella_workshop/styles/workshop.css');

$exchange = local_tella_workshop_exchange_token();
$init = [
    'apiUrl' => rtrim((string) get_config('local_tella_workshop', 'apiurl'), '/'),
    'activityId' => (string) get_config('local_tella_workshop', 'activityid'),
    'token' => $exchange['ok'] ? $exchange['data']['access'] : '',
    'user' => $exchange['ok'] ? ($exchange['data']['user'] ?? null) : [
        'display_name' => fullname($USER),
        'moodle_user_id' => (string) $USER->id,
    ],
    'offline' => empty($exchange['ok']),
];

$PAGE->requires->js_call_amd('local_tella_workshop/tella_app', 'init', [$init]);

echo $OUTPUT->header();
echo $OUTPUT->render_from_template('local_tella_workshop/workshop_container', [
    'loading' => get_string('loading', 'local_tella_workshop'),
]);
echo $OUTPUT->footer();
