const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const plugin = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(plugin, relative), 'utf8');

test('plugin ships the generic experiment runner and two real adapters', () => {
    [
        'version.php',
        'lib.php',
        'settings.php',
        'db/access.php',
        'classes/privacy/provider.php',
        'templates/workshop_container.mustache',
        'styles/workshop.css',
        'amd/src/api.js',
        'amd/src/experiment.js',
        'amd/src/geogebra.js',
        'amd/src/linear_programming.js',
        'amd/src/placeholder.js',
        'amd/build/experiment.min.js',
        'amd/build/geogebra.min.js',
        'amd/build/linear_programming.min.js',
        'amd/build/placeholder.min.js'
    ].forEach(relative => assert.ok(fs.existsSync(path.join(plugin, relative)), relative));
});

test('entry point requires Moodle auth and loads only the data-driven runner', () => {
    const page = read('index.php');
    assert.match(page, /require_login\(\)/);
    assert.match(page, /require_capability\('local\/tella_workshop:view'/);
    assert.match(page, /optional_param\('activity'/);
    assert.match(page, /local_tella_workshop\/experiment/);
    assert.equal((page.match(/js_call_amd/g) || []).length, 1);
    assert.doesNotMatch(page, /fallbackconfig|workshopConfig|price1|SAMPLE_/);
});

test('the adjacent careers route remains standalone after removing workshop tabs', () => {
    const page = read('careers.php');
    assert.match(page, /require_login\(\)/);
    assert.match(page, /local_tella_workshop\/careers/);
    assert.doesNotMatch(page, /redirect\(|\['tab'\s*=>\s*'careers'\]/);
});

test('active runtime has no embedded lesson, formula, material, or dataset', () => {
    const runtime = [
        'index.php',
        'amd/src/api.js',
        'amd/src/experiment.js',
        'amd/src/geogebra.js',
        'amd/src/linear_programming.js',
        'amd/src/placeholder.js'
    ].map(read).join('\n');
    assert.doesNotMatch(runtime, /Bakery|Espresso|SAMPLE_BAKERY|priceDrop|bestCombination/);
    assert.doesNotMatch(runtime, /material_id\s*[:=]\s*['"][A-Za-z0-9]/);
});

test('container and responsive visual tokens are isolated under the plugin root', () => {
    const template = read('templates/workshop_container.mustache');
    const css = read('styles/workshop.css');
    assert.match(template, /class="tella-workshop"/);
    assert.match(template, /data-region="tella-workshop"/);
    assert.match(css, /^\.tella-workshop\s*\{/);
    assert.match(css, /--tella-primary:/);
    assert.match(css, /font-family:\s*Inter,/);
    assert.match(css, /@media \(max-width: 640px\)/);
    assert.match(css, /-webkit-overflow-scrolling:\s*touch/);
    assert.match(css, /touch-action:\s*manipulation/);
    assert.doesNotMatch(css, /(^|\})\s*(body|html|:root|#page)\b/m);
});
