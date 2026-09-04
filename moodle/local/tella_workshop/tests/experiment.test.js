const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const plugin = path.resolve(__dirname, '..');

function loadAmd(relative, dependencies = {}, globals = {}) {
    let exported;
    const windowRef = globals.window || {
        setInterval,
        clearInterval,
        setTimeout,
        clearTimeout,
        addEventListener() {},
        removeEventListener() {}
    };
    const context = {
        Promise,
        console,
        setInterval,
        clearInterval,
        setTimeout,
        clearTimeout,
        window: windowRef,
        document: globals.document || {},
        navigator: globals.navigator || {onLine: true},
        localStorage: globals.localStorage || {getItem: () => null, setItem() {}},
        fetch: globals.fetch,
        define(names, factory) {
            exported = factory(...names.map(name => dependencies[name]));
        }
    };
    vm.runInNewContext(
        fs.readFileSync(path.join(plugin, relative), 'utf8'),
        context,
        {filename: relative}
    );
    return exported;
}

test('activity discovery selects a published experiment definition, not a hardcoded activity type', async () => {
    const selected = {
        id: 'admin-selected',
        activity_type: 'READING',
        experiment: {configuration: {schema_version: 1, renderer: 'placeholder'}}
    };
    const programs = [{courses: [{published_version: {chapters: [{subtopics: [{activities: [
        {id: 'legacy', activity_type: 'INTERACTIVE_WORKSHOP', experiment: null},
        selected
    ]}]}]}}]}];
    const api = loadAmd('amd/src/api.js', {}, {
        fetch: async () => ({ok: true, json: async () => programs})
    });

    const result = await api.loadActivity('https://api.invalid', 'token', '');

    assert.equal(result.id, selected.id);
});

test('failed progress flush retains telemetry for the next reconnection', async () => {
    let stored = JSON.stringify([{path: '/api/v1/progress/', method: 'POST', body: {activity: 'id'}}]);
    const api = loadAmd('amd/src/api.js', {}, {
        fetch: async () => ({ok: false, status: 503, json: async () => ({})}),
        navigator: {onLine: true},
        localStorage: {
            getItem: () => stored,
            setItem: (_key, value) => { stored = value; }
        }
    });

    await api.flush('https://api.invalid', 'token');

    assert.equal(JSON.parse(stored).length, 1);
});

test('runner passes the complete admin definition through its adapter interface', async () => {
    const mounted = [];
    const progress = [];
    const errors = [];
    const definition = {
        schema_version: 1,
        renderer: 'placeholder',
        renderer_config: {message: 'Administrator supplied'},
        future_extension: {preserved: true}
    };
    const activity = {
        id: 'activity-id',
        title: 'Administrator supplied title',
        experiment: {experiment_type: 'SIMULATION', instructions: 'Administrator supplied', configuration: definition}
    };
    const experiment = loadAmd('amd/src/experiment.js', {
        'local_tella_workshop/api': {},
        'local_tella_workshop/geogebra': {},
        'local_tella_workshop/placeholder': {}
    });
    const runner = experiment.createRunner({
        api: {
            flush() {},
            loadActivity: async () => activity,
            saveProgress: async (_url, _token, body) => progress.push(body)
        },
        adapters: {
            placeholder: {
                mount(host, received) {
                    mounted.push({host, received});
                    return () => {};
                }
            }
        },
        view: {
            showLoading() {},
            showError: message => errors.push(message),
            showActivity: () => ({name: 'renderer-host'}),
            setStatus() {}
        },
        strings: {},
        isOnline: () => true
    });

    await runner.start({apiUrl: 'https://api.invalid', token: 'token', activityId: activity.id});

    assert.equal(errors.length, 0);
    assert.equal(mounted.length, 1);
    assert.equal(mounted[0].received, definition);
    assert.equal(mounted[0].received.future_extension.preserved, true);
    assert.equal(progress[0].activity, activity.id);
    assert.equal(progress[0].extra.experiment.renderer, 'placeholder');
    assert.equal(runner.isMounted(), true);
});

test('runner refuses to invent behavior for an unknown renderer', async () => {
    const errors = [];
    const experiment = loadAmd('amd/src/experiment.js', {
        'local_tella_workshop/api': {},
        'local_tella_workshop/geogebra': {},
        'local_tella_workshop/placeholder': {}
    });
    const runner = experiment.createRunner({
        api: {
            flush() {},
            loadActivity: async () => ({
                id: 'activity-id',
                experiment: {configuration: {schema_version: 1, renderer: 'not-installed'}}
            }),
            saveProgress: async () => null
        },
        adapters: {},
        view: {
            showLoading() {},
            showError: message => errors.push(message),
            showActivity() { throw new Error('must not mount'); },
            setStatus() {}
        },
        strings: {rendererUnsupported: 'unsupported'},
        isOnline: () => true
    });

    await runner.start({apiUrl: 'https://api.invalid', token: 'token'});

    assert.deepEqual(errors, ['unsupported']);
    assert.equal(runner.isMounted(), false);
});

test('GeoGebra adapter maps admin material settings and reports configured objects', async () => {
    let parameters;
    let poll;
    const reports = [];
    const statuses = [];
    const values = {parameter_a: 4, completion_flag: 0};
    const applet = {
        getValue: name => values[name],
        getValueString: () => ''
    };
    function GGBApplet(received) {
        parameters = received;
        this.inject = () => received.appletOnLoad(applet);
    }
    const documentRef = {
        createElement: () => ({id: '', className: '', parentNode: null})
    };
    const host = {
        children: [],
        classList: {add() {}},
        appendChild(node) { node.parentNode = this; this.children.push(node); },
        removeChild(node) { node.parentNode = null; this.children = this.children.filter(item => item !== node); }
    };
    const geogebra = loadAmd('amd/src/geogebra.js', {
        'local_tella_workshop/linear_programming': {createAdapter: () => ({mount() {}})}
    }, {document: documentRef});
    const adapter = geogebra.createAdapter({
        document: documentRef,
        loadScript: async () => GGBApplet,
        setInterval: callback => { poll = callback; return 17; },
        clearInterval() {},
        setTimeout: () => 23,
        clearTimeout() {}
    });
    const cleanup = await adapter.mount(host, {
        renderer_config: {
            material_id: 'admin-material-id',
            app_name: '3d',
            parameters: {showToolBar: false}
        },
        tracking: {
            watch_objects: ['parameter_a'],
            completion: {object: 'completion_flag', operator: 'equals', value: 1},
            throttle_ms: 500
        }
    }, {
        strings: {},
        setStatus: status => statuses.push(status),
        reportProgress: update => reports.push(update)
    });

    assert.equal(parameters.material_id, 'admin-material-id');
    assert.equal(parameters.appName, '3d');
    assert.equal(parameters.showToolBar, false);
    assert.equal(parameters.scaleContainerClass, 'tella-geogebra-frame');
    assert.equal(parameters.autoHeight, true);
    assert.equal(reports[0].state.values.parameter_a, 4);
    assert.equal(reports[0].status, 'in_progress');
    values.completion_flag = 1;
    poll();
    await Promise.resolve();
    assert.equal(reports.at(-1).status, 'completed');
    assert.equal(reports.at(-1).progress_percentage, 100);
    assert.equal(statuses.at(-1), 'Completion saved.');
    cleanup();
    assert.equal(host.children.length, 0);
});
