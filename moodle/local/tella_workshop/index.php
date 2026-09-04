<?php
require_once(__DIR__ . '/../../config.php');
require_once(__DIR__ . '/lib.php');

require_login();
$context = context_system::instance();
require_capability('local/tella_workshop:view', $context);

$configuredactivity = (string) get_config('local_tella_workshop', 'activityid');
$activityid = optional_param('activity', $configuredactivity, PARAM_ALPHANUMEXT);

$PAGE->set_context($context);
$pageparams = $activityid === '' ? [] : ['activity' => $activityid];
$PAGE->set_url(new moodle_url('/local/tella_workshop/index.php', $pageparams));
$PAGE->set_pagelayout('standard');
$PAGE->set_title(get_string('pageheading', 'local_tella_workshop'));
$PAGE->set_heading(get_string('pageheading', 'local_tella_workshop'));
$PAGE->navbar->add(get_string('navtab', 'local_tella_workshop'));
$PAGE->requires->css('/local/tella_workshop/styles/workshop.css');

$exchange = local_tella_workshop_exchange_token();
$init = [
    'apiUrl' => rtrim((string) get_config('local_tella_workshop', 'apiurl'), '/'),
    'activityId' => $activityid,
    'token' => $exchange['ok'] ? $exchange['data']['access'] : '',
    'strings' => [
        'activityUnavailable' => get_string('activityunavailable', 'local_tella_workshop'),
        'authenticationRequired' => get_string('authenticationrequired', 'local_tella_workshop'),
        'completionSaved' => get_string('completionsaved', 'local_tella_workshop'),
        'configurationMissing' => get_string('configurationmissing', 'local_tella_workshop'),
        'geogebraLoading' => get_string('geogebraloading', 'local_tella_workshop'),
        'instructions' => get_string('instructions', 'local_tella_workshop'),
        'interactiveReady' => get_string('interactiveready', 'local_tella_workshop'),
        'loading' => get_string('loading', 'local_tella_workshop'),
        'online' => get_string('online', 'local_tella_workshop'),
        'onlineRequired' => get_string('onlinerequired', 'local_tella_workshop'),
        'placeholderReady' => get_string('placeholderready', 'local_tella_workshop'),
        'rendererFailed' => get_string('rendererfailed', 'local_tella_workshop'),
        'rendererUnsupported' => get_string('rendererunsupported', 'local_tella_workshop'),
    ],
];

$PAGE->requires->js_call_amd('local_tella_workshop/experiment', 'init', [$init]);

echo $OUTPUT->header();
echo $OUTPUT->render_from_template('local_tella_workshop/workshop_container', [
    'loading' => get_string('loading', 'local_tella_workshop'),
]);
echo $OUTPUT->footer();
