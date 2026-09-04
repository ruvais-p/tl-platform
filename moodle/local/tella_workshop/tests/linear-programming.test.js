const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const plugin = path.resolve(__dirname, '..');

function loadModule() {
    let exported;
    vm.runInNewContext(fs.readFileSync(path.join(plugin, 'amd/src/linear_programming.js'), 'utf8'), {
        Array,
        Math,
        Number,
        Object,
        Promise,
        RegExp,
        String,
        isFinite,
        define(_names, factory) { exported = factory(); }
    });
    return exported;
}

function referenceWorkspace() {
    return {
        type: 'linear_programming',
        title: 'LP model formulation',
        problem_statement: 'Choose a profitable production mix.',
        axis_variables: ['x1', 'x2'],
        variables: [
            {id: 'x1', label: 'Product A', symbol: 'x1', unit: 'units', min: 20, max: 50, initial: 20, step: 1},
            {id: 'x2', label: 'Product B', symbol: 'x2', unit: 'units', min: 0, max: 25, initial: 5, step: 1},
            {id: 'x3', label: 'Product C', symbol: 'x3', unit: 'units', min: 0, max: 30, initial: 10, step: 1}
        ],
        objective: {
            label: 'Profit', sense: 'maximize', currency: '₹',
            coefficients: {x1: 12, x2: 20, x3: 45}
        },
        constraints: [
            {id: 'labour', label: 'Assembly time', coefficients: {x1: 0.8, x2: 1.7, x3: 2.5}, operator: '<=', rhs: 100},
            {id: 'commitment', label: 'Combined commitment', coefficients: {x1: 0, x2: 1, x3: 1}, operator: '>=', rhs: 15}
        ]
    };
}

test('data-driven LP solver reproduces the reference slice without lesson constants in runtime', () => {
    const module = loadModule();
    const parsed = module.parseWorkspace(referenceWorkspace());
    assert.equal(parsed.errors.length, 0);

    const solution = module.solve(parsed.workspace, module.initialState(parsed.workspace));

    assert.equal(solution.ok, true);
    assert.equal(solution.vertices.length, 5);
    assert.ok(Math.abs(solution.area - 579.31985294) < 0.00001);
    assert.ok(Math.abs(solution.allocation.x1 - 50) < 0.00001);
    assert.ok(Math.abs(solution.allocation.x2 - 20.58823529) < 0.00001);
    assert.equal(solution.allocation.x3, 10);
    assert.ok(Math.abs(solution.best.objectiveValue - 1461.76470588) < 0.00001);
});

test('workspace parser rejects an incomplete admin definition', () => {
    const module = loadModule();
    const workspace = referenceWorkspace();
    delete workspace.objective.coefficients.x2;

    const parsed = module.parseWorkspace(workspace);

    assert.equal(parsed.workspace, null);
    assert.match(parsed.errors.join(' '), /every variable/);
});
