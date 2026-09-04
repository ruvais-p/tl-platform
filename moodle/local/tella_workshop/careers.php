<?php
require_once(__DIR__ . '/../../config.php');
require_once(__DIR__ . '/lib.php');

require_login();
$context = context_system::instance();
require_capability('local/tella_workshop:view', $context);

$indexurl = new moodle_url('/local/tella_workshop/index.php');
$PAGE->set_context($context);
$PAGE->set_url(new moodle_url('/local/tella_workshop/careers.php'));
$PAGE->set_pagelayout('standard');
$PAGE->set_title(get_string('careersheading', 'local_tella_workshop'));
$PAGE->set_heading(get_string('pageheading', 'local_tella_workshop'));
$PAGE->navbar->add(get_string('navtab', 'local_tella_workshop'), $indexurl);
$PAGE->navbar->add(get_string('careers', 'local_tella_workshop'));
$PAGE->requires->css('/local/tella_workshop/styles/workshop.css');

$exchange = local_tella_workshop_exchange_token();
$init = [
    'apiUrl' => rtrim((string) get_config('local_tella_workshop', 'apiurl'), '/'),
    'token' => $exchange['ok'] ? $exchange['data']['access'] : '',
    'strings' => [
        'authenticationRequired' => get_string('authenticationrequired', 'local_tella_workshop'),
        'careersPlaceholder' => get_string('careersplaceholder', 'local_tella_workshop'),
        'openDetails' => get_string('opendetails', 'local_tella_workshop'),
    ],
];
$PAGE->requires->js_call_amd('local_tella_workshop/careers', 'init', [$init]);

echo $OUTPUT->header();
echo $OUTPUT->render_from_template('local_tella_workshop/careers', [
    'backurl' => $indexurl->out(false),
    'backlabel' => get_string('navtab', 'local_tella_workshop'),
    'heading' => get_string('careersheading', 'local_tella_workshop'),
    'placeholder' => get_string('careersplaceholder', 'local_tella_workshop'),
]);
echo $OUTPUT->footer();
