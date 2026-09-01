<?php
namespace local_tella_workshop;

defined('MOODLE_INTERNAL') || die();

/**
 * Hook callbacks for Moodle primary navigation.
 */
class hook_callbacks {
    /**
     * Add Skill Enhancement to the site primary navigation (Home / Dashboard / My courses).
     *
     * @param \core\hook\navigation\primary_extend $hook
     */
    public static function extend_primary(\core\hook\navigation\primary_extend $hook): void {
        if (!isloggedin() || isguestuser()) {
            return;
        }
        $hook->get_primaryview()->add(
            get_string('navtab', 'local_tella_workshop'),
            new \moodle_url('/local/tella_workshop/index.php'),
            \navigation_node::TYPE_CUSTOM,
            null,
            'tella_skill_enhancement'
        );
    }
}
