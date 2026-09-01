const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const plugin = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(plugin, relative), 'utf8');

test('plugin has the minimal Moodle structure', () => {
    [
        'version.php',
        'lib.php',
        'settings.php',
        'db/access.php',
        'db/hooks.php',
        'db/install.php',
        'db/upgrade.php',
        'classes/privacy/provider.php',
        'classes/hook_callbacks.php',
        'lang/en/local_tella_workshop.php',
        'index.php'
    ].forEach(relative => assert.ok(fs.existsSync(path.join(plugin, relative)), relative));
});

test('entry point is an authenticated Moodle-native Tella page', () => {
    const page = read('index.php');
    assert.match(page, /require_login\(\)/);
    assert.match(page, /require_capability\('local\/tella_workshop:view'/);
    assert.match(page, /set_primary_active_tab\('tella_skill_enhancement'\)/);
    assert.match(page, /echo \$OUTPUT->header\(\)/);
    assert.match(page, /echo \$OUTPUT->footer\(\)/);
    assert.match(page, /local_tella_workshop_exchange_token/);
    assert.match(page, /js_call_amd\('local_tella_workshop\/tella_app'/);
    assert.match(page, /render_from_template\('local_tella_workshop\/workshop_container'/);
});

test('student experience is scoped, reusable, responsive and accessible', () => {
    const template = read('templates/workshop_container.mustache');
    const css = read('styles/workshop.css');
    const app = read('amd/src/tella_app.js');
    assert.match(template, /class="tella-plugin"/);
    assert.match(css, /\.tella-plugin\s*\{/);
    assert.doesNotMatch(css, /(^|\})\s*(body|html|:root|#page)\b/m);
    assert.match(css, /prefers-reduced-motion/);
    assert.match(app, /function skillLab\(skill\)/);
    assert.match(app, /function workshop\(skill\)/);
    assert.match(app, /Business View/);
    assert.match(app, /Tella Coach/);
    assert.match(app, /TV factory — lecture baseline/);
    assert.match(app, /Two TV Models, One Profit Hill/);
    assert.match(app, /chart3d\.drawContour/);
    assert.match(app, /function updateCalculusLive\(\)/);
    assert.match(app, /function updateLinearLive\(\)/);
    assert.match(app, /data-linear-results/);
    assert.match(app, /requestAnimationFrame/);
    assert.match(app, /if \(key === 'tvX' \|\| key === 'tvY'\)/);
    assert.match(app, /Current mix/);
    assert.match(app, /Interactive 3D profit hill/);
    assert.match(app, /bindSurfaceInteraction/);
    assert.match(app, /Profit level/);
    assert.match(app, /function completeRound/);
    assert.match(app, /persistProgress/);
    assert.match(app, /workshopApi\.saveProgress/);
    assert.match(app, /Complete the previous round first/);
    assert.match(app, /function sizeCanvas\(canvas, isSlice\)/);
    assert.doesNotMatch(app, /Cobb-Douglas/);
    assert.match(app, /role="progressbar"/);
});
