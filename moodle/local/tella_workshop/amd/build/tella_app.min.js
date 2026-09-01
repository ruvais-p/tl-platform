define(['local_tella_workshop/math', 'local_tella_workshop/chart3d', 'local_tella_workshop/api'], function (workshopMath, chart3d, workshopApi) {
    var root;
    var calcFrame;
    var tvGrid;
    var config = {};
    var state = {view: 'home', skill: 'linear', x: 24, y: 8, tvX: 3000, tvY: 5000, math: false, calc3d: false, calcRound: 1, calcFreeze: 'y', scenario: false, completed: false,
        calcDone: [], surfaceExplored: false, freezeChanged: false, lpStep: 1, lpLines: [], lpDraftPoints: [], lpPlotFeedback: '', lpRegionMarked: false, lpRegionFeedback: '', lpChoiceFeedback: '', lpChoiceLocked: false};
    var activityId = '';
    var progressKey = 'tella.tvProfitHill.progress';
    var startedAt = Date.now();
    var surfaceView = {rotation: -0.72, elevation: 0.62, zoom: 1};
    var tvFactory = {
        name: 'TV factory — lecture baseline', price1: 339, priceDrop1: 0.01, cost1: 195,
        price2: 399, priceDrop2: 0.01, cost2: 225, congestion: 0.007, fixedCost: 400000,
        currentX: 3000, currentY: 5000,
        labels: {product1: '19-inch TVs', product2: '21-inch TVs', unit1: '19-inch TVs', unit2: '21-inch TVs', currency: '$'}
    };

    function icon(name) {
        var paths = {
            play: '<path d="m9 7 8 5-8 5V7Z"/>',
            flask: '<path d="M9 3h6M10 3v5l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3M8 14h8"/>',
            chart: '<path d="M4 19V5M4 19h16M7 15l4-4 3 2 5-6"/>',
            check: '<path d="m5 12 4 4L19 6"/>',
            lock: '<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
            spark: '<path d="m12 3 1.4 4.6L18 9l-4.6 1.4L12 15l-1.4-4.6L6 9l4.6-1.4L12 3ZM18 15l.7 2.3L21 18l-2.3.7L18 21l-.7-2.3L15 18l2.3-.7L18 15Z"/>',
            arrow: '<path d="m9 18 6-6-6-6"/>',
            back: '<path d="m15 18-6-6 6-6"/>',
            warning: '<path d="M12 4 3 20h18L12 4Z"/><path d="M12 9v5M12 17h.01"/>',
            info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 8h.01"/>'
        };
        return '<svg class="tella-icon" aria-hidden="true" viewBox="0 0 24 24">' + (paths[name] || paths.info) + '</svg>';
    }

    function badge(type) {
        return '<span class="tella-badge tella-badge--' + type.toLowerCase() + '">' + type + '</span>';
    }

    function progress(value, label) {
        return '<div class="tella-progress" role="progressbar" aria-label="' + label + '" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + value + '"><span style="width:' + value + '%"></span></div>';
    }

    function progressPercent() { return state.completed ? 100 : state.calcDone.length * 25; }

    function restoreProgress() {
        try {
            var saved = JSON.parse(localStorage.getItem(progressKey) || '{}');
            state.calcDone = Array.isArray(saved.done) ? saved.done.filter(function (n) { return n >= 1 && n <= 4; }) : [];
            state.calcRound = Math.min(4, Math.max(1, Number(saved.round) || state.calcDone.length + 1));
            state.completed = !!saved.completed;
            state.surfaceExplored = !!saved.surfaceExplored; state.freezeChanged = !!saved.freezeChanged;
            if (Number.isFinite(saved.tvX)) state.tvX = saved.tvX;
            if (Number.isFinite(saved.tvY)) state.tvY = saved.tvY;
        } catch (e) { /* Keep safe defaults when storage is unavailable. */ }
    }

    function persistProgress(eventCode) {
        var saved = {done: state.calcDone, round: state.calcRound, completed: state.completed, surfaceExplored: state.surfaceExplored,
            freezeChanged: state.freezeChanged, tvX: state.tvX, tvY: state.tvY};
        try { localStorage.setItem(progressKey, JSON.stringify(saved)); } catch (e) { /* API sync can still succeed. */ }
        if (!activityId) return;
        workshopApi.saveProgress(config.apiUrl, config.token, {activity: activityId, progress_percentage: progressPercent(),
            status: state.completed ? 'completed' : 'in_progress', time_spent_seconds: Math.round((Date.now() - startedAt) / 1000),
            extra: {workshop: 'tv-profit-hill', round: state.calcRound, completed_rounds: state.calcDone}, event: eventCode || ''});
    }

    function roundReady(round) {
        if (round === 1) return state.surfaceExplored;
        if (round === 2) return state.freezeChanged;
        if (round === 3) return Math.abs(workshopMath.slopeX(state.tvX, state.tvY, tvFactory)) < 2 && Math.abs(workshopMath.slopeY(state.tvX, state.tvY, tvFactory)) < 2;
        return round === 4;
    }

    function completeRound() {
        var round = state.calcRound;
        if (!roundReady(round)) return;
        if (state.calcDone.indexOf(round) < 0) state.calcDone.push(round);
        state.calcDone.sort();
        if (round === 4) { state.completed = true; persistProgress(); render(); return; }
        state.calcRound = round + 1; persistProgress(round === 3 ? 'reach_peak' : round === 2 ? 'explore_slopes' : ''); render();
    }

    function pageHeader(title, copy, meta) {
        return '<header class="tella-page-header"><div><h1>' + title + '</h1><p>' + copy + '</p></div>' + (meta || '') + '</header>';
    }

    function home() {
        return '<main class="tella-page">' +
            pageHeader('Tella', 'Practice concepts through workshops, experiments and real-world challenges.', '<div class="tella-stats"><span><b>' + (850 + state.calcDone.length * 50) + '</b> XP</span><span>Level 3</span><span>3-day streak</span></div>') +
            '<section aria-labelledby="continue-title"><div class="tella-section-head"><h2 id="continue-title">Continue learning</h2></div>' +
            '<article class="tella-continue"><div class="tella-continue-icon">' + icon('flask') + '</div><div class="tella-continue-main">' + badge('EXPERIMENT') + '<h3>Production Control Panel</h3><p>Linear Programming</p></div><div class="tella-continue-progress"><span>64% complete</span>' + progress(64, 'Production Control Panel progress') + '</div><button class="tella-btn tella-btn--primary" data-go="workshop-linear">Continue ' + icon('arrow') + '</button></article></section>' +
            '<section aria-labelledby="labs-title"><div class="tella-section-head"><div><h2 id="labs-title">Skill Labs</h2><p>Explore a concept through a connected learning journey.</p></div></div><div class="tella-lab-grid">' +
            labCard('linear', 'Linear Programming', 'Explore optimisation, constraints and strategic decision-making through interactive business scenarios.', '2 videos · Workshops · Challenges', 'chart') +
            labCard('calculus', 'Multivariable Calculus', 'Explore how multiple variables interact in optimisation, production and business decision-making.', 'Videos · Experiments · Workshops', 'flask') +
            '</div></section><section class="tella-recent" aria-labelledby="recent-title"><div class="tella-section-head"><h2 id="recent-title">Recent activity</h2></div><div class="tella-recent-row"><span class="tella-status-icon">' + icon('check') + '</span><div><b>Linear Programming in Business</b><small>Video · Completed yesterday</small></div><span class="tella-xp">+40 XP</span></div></section></main>';
    }

    function labCard(skill, title, copy, meta, motif) {
        return '<article class="tella-lab-card"><div class="tella-lab-motif tella-lab-motif--' + skill + '">' + icon(motif) + '<i></i><i></i><i></i></div><div class="tella-lab-body"><h3>' + title + '</h3><p>' + copy + '</p><small>' + meta + '</small><button class="tella-btn tella-btn--secondary" data-go="skill-' + skill + '">Open Skill Lab ' + icon('arrow') + '</button></div></article>';
    }

    var labs = {
        linear: {
            title: 'Linear Programming', copy: 'Learn how optimisation models become real business decisions.', mastery: 64,
            activities: [
                ['Understand', 'VIDEO', 'Linear Programming in Business', 'Completed', 'check'],
                ['Explore', 'EXPERIMENT', 'Production Control Panel', 'Continue', 'flask'],
                ['Apply', 'WORKSHOP', 'Run the Clean-Energy Supply Chain', 'Available', 'chart'],
                ['Challenge', 'CHALLENGE', 'Supply Chain Disruption', 'Locked', 'lock']
            ], concepts: ['Decision Variables', 'Objective Function', 'Constraints', 'Feasible Region', 'Sensitivity']
        },
        calculus: {
            title: 'Multivariable Calculus', copy: 'Understand a two-product profit function through the approved TV-factory workshop.', mastery: 48,
            activities: [
                ['Understand', 'VIDEO', 'Two Products, One Function', 'Completed', 'check'],
                ['Explore', 'EXPERIMENT', 'Two TV Models, One Profit Hill', 'Continue', 'flask'],
                ['Apply', 'WORKSHOP', 'Read the Slopes and Walk Uphill', 'Available', 'chart'],
                ['Challenge', 'CHALLENGE', 'Build Your Own Business Question', 'Locked', 'lock']
            ], concepts: ['Partial Derivatives', 'Gradient', 'Contour Maps', 'Critical Point', 'Profit Optimisation']
        }
    };

    function skillLab(skill) {
        var data = labs[skill];
        var mastery = skill === 'calculus' ? data.mastery + Math.round(8 * progressPercent() / 100) : data.mastery;
        var cards = data.activities.map(function (a, index) {
            var activityState = a[3];
            if (skill === 'linear' && index === 2 && state.completed) activityState = 'Completed';
            if (skill === 'linear' && index === 3 && state.completed) activityState = 'Available';
            if (skill === 'calculus' && index === 1) activityState = state.calcDone.length === 4 ? 'Completed' : state.calcDone.length ? 'Continue' : 'Available';
            if (skill === 'calculus' && index === 2) activityState = state.calcDone.length === 4 ? 'Available' : 'Locked';
            var current = index === 1 && activityState !== 'Completed';
            var action = a[1] === 'VIDEO' ? ' data-video' : ' data-go="workshop-' + skill + '"';
            return '<article class="tella-journey-card ' + (current ? 'is-current' : '') + '"><div class="tella-journey-step"><span>' + (index + 1) + '</span><i></i></div><div class="tella-activity-icon">' + icon(activityState === 'Completed' ? 'check' : activityState === 'Locked' ? 'lock' : a[4]) + '</div><div class="tella-activity-copy"><span class="tella-phase">' + a[0] + '</span>' + badge(a[1]) + '<h3>' + a[2] + '</h3><p class="tella-state tella-state--' + activityState.toLowerCase() + '">' + (activityState === 'Completed' ? icon('check') : activityState === 'Locked' ? icon('lock') : '') + activityState + '</p></div>' + (activityState !== 'Locked' ? '<button class="tella-btn tella-btn--' + (current ? 'primary' : 'secondary') + '"' + action + '>' + (current ? 'Continue' : activityState === 'Completed' ? 'Review' : 'Open') + icon('arrow') + '</button>' : '') + '</article>';
        }).join('');
        return '<main class="tella-page"><button class="tella-back" data-go="home">' + icon('back') + ' Tella</button>' +
            pageHeader(data.title, data.copy, '<div class="tella-mastery"><div><span>Skill mastery</span><b>' + mastery + '%</b></div>' + progress(mastery, data.title + ' mastery') + '</div>') +
            '<section><div class="tella-section-head"><div><h2>Learning journey</h2><p>Understand → Explore → Apply → Challenge</p></div></div><div class="tella-journey">' + cards + '</div></section>' +
            '<section class="tella-concepts"><h2>Concepts practised</h2><div>' + data.concepts.map(function (c) { return '<span>' + c + '</span>'; }).join('') + '</div></section></main>';
    }

    function constraint(label, used, max) {
        var pct = Math.round(used / max * 100); var status = pct > 100 ? 'danger' : pct >= 85 ? 'warning' : 'normal';
        return '<div class="tella-gauge tella-gauge--' + status + '"><div><span>' + label + '</span><b>' + used + ' / ' + max + '</b></div>' + progress(Math.min(pct, 100), label + ' usage') + '<small>' + (status === 'danger' ? 'Limit exceeded' : status === 'warning' ? 'Approaching limit' : 'Within limit') + '</small></div>';
    }

    function lpVisual(x, y, feasible, batteryMax) {
        var left = 64, top = 32, width = 470, height = 270;
        var mapX = function (value) { return left + value / 50 * width; };
        var mapY = function (value) { return top + (1 - value / 35) * height; };
        var px = mapX(x), py = mapY(y);
        var batteryIntercept = batteryMax / 3;
        var batteryTopX = Math.max(0, (batteryMax - 70) / 3);
        var batteryTopY = Math.min(35, batteryMax / 2);
        var intersectionX = (batteryMax - 50) / 2;
        var intersectionY = (50 - intersectionX) / 2;
        var polygon = [[0, 0], [batteryIntercept, 0], [intersectionX, intersectionY], [0, 25]].map(function (point) { return mapX(point[0]).toFixed(1) + ',' + mapY(point[1]).toFixed(1); }).join(' ');
        var ticks = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50].map(function (value) {
            return '<line x1="' + mapX(value) + '" y1="' + top + '" x2="' + mapX(value) + '" y2="' + (top + height) + '"/><text class="tella-lp-x-tick" x="' + mapX(value) + '" y="' + (top + height + 18) + '">' + value + '</text>';
        }).join('') + [0, 5, 10, 15, 20, 25, 30, 35].map(function (value) {
            return '<line x1="' + left + '" y1="' + mapY(value) + '" x2="' + (left + width) + '" y2="' + mapY(value) + '"/><text class="tella-lp-y-tick" x="' + (left - 10) + '" y="' + (mapY(value) + 4) + '">' + value + '</text>';
        }).join('');
        var show = function (name) { return state.lpLines.indexOf(name) >= 0; };
        var drawing = state.lpStep === 1;
        var region = state.lpStep > 1 && state.lpRegionMarked;
        var draftMarks = drawing ? state.lpDraftPoints.map(function (point) { return '<circle class="tella-lp-draft-point" cx="' + mapX(point[0]) + '" cy="' + mapY(point[1]) + '" r="5"/>'; }).join('') : '';
        return '<div class="tella-lp-visual"><svg data-lp-graph viewBox="0 0 600 370" role="img" aria-label="Production constraints graph. ' + (drawing ? 'Find and mark two points for the current boundary line.' : 'Click inside the overlap of all constraints to mark the feasible region.') + '"><defs><pattern id="lp-grid" width="47" height="38.6" patternUnits="userSpaceOnUse"><path d="M47 0H0V38.6" fill="none" stroke="#e8ebef"/></pattern></defs><rect x="' + left + '" y="' + top + '" width="' + width + '" height="' + height + '" fill="url(#lp-grid)"/>' + (region ? '<polygon class="tella-feasible" points="' + polygon + '"/>' : '') + '<rect class="tella-region-click-area" x="' + left + '" y="' + top + '" width="' + width + '" height="' + height + '"/>' + '<g class="tella-lp-grid">' + ticks + '</g>' + (show('labour') ? '<line class="tella-lp-limit tella-lp-limit--labour" x1="' + mapX(0) + '" y1="' + mapY(25) + '" x2="' + mapX(50) + '" y2="' + mapY(0) + '"><title>Labour constraint: 2x + 4y ≤ 100</title></line>' : '') + (show('battery') ? '<line class="tella-lp-limit tella-lp-limit--battery" x1="' + mapX(batteryTopX) + '" y1="' + mapY(batteryTopY) + '" x2="' + mapX(batteryIntercept) + '" y2="' + mapY(0) + '"><title>Battery constraint: 3x + 2y ≤ ' + batteryMax + '</title></line>' : '') + (show('carbon') ? '<line class="tella-lp-limit tella-lp-limit--carbon" x1="' + mapX(10) + '" y1="' + mapY(35) + '" x2="' + mapX(50) + '" y2="' + mapY(15) + '"><title>Carbon constraint: x + 2y ≤ 80</title></line>' : '') + draftMarks + '<path d="M' + left + ' ' + top + 'V' + (top + height) + 'H' + (left + width) + '" class="tella-axis"/>' + (state.lpStep === 3 ? '<circle class="tella-selected ' + (feasible ? '' : 'is-infeasible') + '" cx="' + px + '" cy="' + py + '" r="7"/>' : '') + '<text x="' + (left + 4) + '" y="' + (top + 13) + '" class="tella-axis-label">Solar storage (y)</text><text x="' + (left + width - 92) + '" y="' + (top + height + 32) + '" class="tella-axis-label">EV production (x)</text>' + (region ? '<text x="' + mapX(2) + '" y="' + mapY(18) + '" class="tella-region-label">FEASIBLE</text>' : '') + '</svg><div class="tella-lp-key"><span><i class="is-labour"></i>Labour</span><span><i class="is-battery"></i>Battery</span><span><i class="is-carbon"></i>Carbon</span></div></div>';
    }

    function linearResults() {
        var batteryMax = state.scenario ? 68 : 90;
        var labour = state.x * 2 + state.y * 4, battery = state.x * 3 + state.y * 2, carbon = state.x + state.y * 2;
        var feasible = labour <= 100 && battery <= batteryMax && carbon <= 80;
        var warning = Math.max(labour / 100, battery / batteryMax, carbon / 80) >= .85;
        var profit = state.x * 40 + state.y * 50;
        var utilisation = Math.round(Math.max(labour / 100, battery / batteryMax, carbon / 80) * 100);
        var efficient = feasible && profit >= (state.scenario ? 1180 : 1500) && (state.lpStep !== 3 || state.lpChoiceLocked);
        return (state.lpStep === 3 ? '<div class="tella-kpis"><div><span>Projected profit</span><b>€' + profit.toLocaleString() + 'k</b></div><div><span>Tightest resource use</span><b>' + utilisation + '%</b></div><div><span>Plan status</span><b class="tella-' + (feasible ? 'success' : 'danger') + '">' + (feasible ? 'Feasible' : 'Infeasible') + '</b></div></div>' : '') +
            (state.math ? mathModel() : lpVisual(state.x, state.y, feasible, batteryMax)) +
            (state.lpStep === 3 && state.scenario ? '<div class="tella-scenario-card"><span>' + icon('warning') + '</span><div><b>Supply Chain Disruption</b><p>A battery-material shipment has been delayed. Available supply has dropped by 25%; adjust your production strategy.</p></div></div>' : '') +
            (state.lpStep === 3 ? '<div class="tella-gauges">' + constraint('Labour', labour, 100) + constraint('Battery supply', battery, batteryMax) + constraint('Carbon limit', carbon, 80) + '</div>' + feedback(feasible, warning, battery, batteryMax, efficient) : '');
    }

    function lpWorkspace() {
        var labels = ['1. Draw constraints', '2. Mark feasible region', '3. Pick the best value'];
        var steps = labels.map(function (label, index) { var n = index + 1; var done = state.lpStep > n; var active = state.lpStep === n; var classes = (active ? 'is-active ' : '') + (done ? 'is-complete' : ''); return n <= state.lpStep ? '<button data-lp-step="' + n + '" class="' + classes + '"><b>' + (done ? '✓' : n) + '</b>' + label + '</button>' : '<span class="' + classes + '"><b>' + n + '</b>' + label + '</span>'; }).join('');
        var panel = '';
        if (state.lpStep === 1) {
            var boundaries = [{key: 'labour', name: 'Labour', equation: '2x + 4y = 100', values: 'Use x = 0 and x = 40.'}, {key: 'battery', name: 'Battery supply', equation: '3x + 2y = 90', values: 'Use x = 10 and x = 30.'}, {key: 'carbon', name: 'Carbon limit', equation: 'x + 2y = 80', values: 'Use x = 20 and x = 40.'}];
            var current = boundaries[state.lpLines.length];
            panel = '<div class="tella-lp-task"><b>Plot each resource boundary</b>' + (current ? '<p>Solve <strong>' + current.equation + '</strong>. ' + current.values + ' Substitute each value, solve for y, then click both points on the graph.</p><div class="tella-lp-plot-status"><span>' + current.name + ' boundary</span><b>' + state.lpDraftPoints.length + ' / 2 points marked</b></div>' + (state.lpPlotFeedback ? '<p class="tella-lp-hint">' + state.lpPlotFeedback + '</p>' : '') + (state.lpDraftPoints.length === 2 ? '<button class="tella-btn tella-btn--primary" data-lp-draw="' + current.key + '">Draw ' + current.name + ' line ' + icon('arrow') + '</button>' : '<button class="tella-btn tella-btn--secondary" data-lp-show-points="' + current.key + '">Show the two points</button>') : '<p>All three boundaries are plotted. Their shared area is the feasible region.</p><button class="tella-btn tella-btn--primary" data-lp-next>Mark the feasible region ' + icon('arrow') + '</button>') + '</div>';
        }
        else if (state.lpStep === 2) panel = '<div class="tella-lp-task"><b>Find the feasible region</b><p>Click the part of the graph that satisfies every constraint at the same time.</p>' + (state.lpRegionFeedback ? '<p class="tella-lp-hint ' + (state.lpRegionMarked ? 'is-good' : '') + '">' + state.lpRegionFeedback + '</p>' : '') + (state.lpRegionMarked ? '<button class="tella-btn tella-btn--primary" data-lp-next>Test production plans ' + icon('arrow') + '</button>' : '') + '</div>';
        else panel = '<div class="tella-lp-task"><b>Choose the highest-profit feasible plan</b><p>Adjust production, then lock in the plan with the greatest profit that stays inside the shaded region. Hint: compare the corner points.</p>' + (state.lpChoiceFeedback ? '<p class="tella-lp-hint is-good">' + state.lpChoiceFeedback + '</p>' : '') + '<button class="tella-btn tella-btn--primary" data-lp-choose>Lock in this plan</button></div>';
        return '<div class="tella-experiment-head"><div><span class="tella-eyebrow">INTERACTIVE EXPERIMENT</span><h2>Production Control Panel</h2></div>' + segment() + '</div>' +
            '<div class="tella-lp-steps">' + steps + '</div>' + panel + (state.lpStep === 3 ? '<div class="tella-control-grid"><label>EV Production <output>' + state.x + '</output><input data-slider="x" type="range" min="0" max="40" value="' + state.x + '" aria-label="EV production units"></label><label>Solar Storage Production <output>' + state.y + '</output><input data-slider="y" type="range" min="0" max="25" value="' + state.y + '" aria-label="Solar storage production units"></label></div>' : '') +
            '<div data-linear-results>' + linearResults() + '</div>';
    }

    function segment() {
        return '<div class="tella-segment" role="group" aria-label="Experiment view"><button data-math="false" class="' + (!state.math ? 'is-active' : '') + '">Business View</button><button data-math="true" class="' + (state.math ? 'is-active' : '') + '">Math View</button></div>';
    }

    function mathModel() {
        return '<section class="tella-math-model"><span class="tella-eyebrow">UNDERLYING MODEL</span><h3>Maximise <em>Z = 40x + 50y</em></h3><div><b>Subject to</b><p>2x + 4y ≤ 100 <small>Labour</small></p><p>3x + 2y ≤ 90 <small>Battery supply</small></p><p>x + 2y ≤ 80 <small>Carbon limit</small></p><p>x, y ≥ 0</p></div></section>';
    }

    function feedback(feasible, warning, battery, batteryMax, efficient) {
        if (!feasible) return '<div class="tella-feedback tella-feedback--danger">' + icon('warning') + '<div><b>This production plan isn’t feasible.</b><span>' + (battery > batteryMax ? 'Battery supply has been exceeded.' : 'An operational limit has been exceeded.') + ' Try adjusting the production mix.</span></div></div>';
        if (efficient) return '<div class="tella-feedback tella-feedback--success">' + icon('check') + '<div><b>Efficient solution <em>+120 XP</em></b><span>Profit increased while all constraints remain satisfied.</span><span class="tella-feedback-actions"><button data-complete>Complete workshop</button>' + (!state.scenario ? '<button data-scenario>Try supply disruption</button>' : '') + '</span></div></div>';
        if (warning) return '<div class="tella-feedback tella-feedback--warning">' + icon('warning') + '<div><b>You are approaching a constraint.</b><span>Review the highlighted resource before increasing production.</span></div></div>';
        return '';
    }

    function bindLinearResultActions(container) {
        container.querySelectorAll('[data-scenario]').forEach(function (el) { el.addEventListener('click', function () { state.scenario = true; render(); }); });
        container.querySelectorAll('[data-complete]').forEach(function (el) { el.addEventListener('click', function () {
            state.completed = true;
            navigate('skill-linear');
        }); });
        container.querySelectorAll('[data-lp-graph]').forEach(function (graph) { graph.addEventListener('click', function (event) {
            if (state.lpStep !== 1 && (state.lpStep !== 2 || state.lpRegionMarked)) return;
            var box = graph.getBoundingClientRect(); var pointX = (event.clientX - box.left) / box.width * 600; var pointY = (event.clientY - box.top) / box.height * 370;
            var x = (pointX - 64) / 470 * 50; var y = (1 - (pointY - 32) / 270) * 35;
            if (state.lpStep === 1) {
                var pointSets = {labour: [[0, 25], [40, 5]], battery: [[10, 30], [30, 0]], carbon: [[20, 30], [40, 20]]};
                var current = ['labour', 'battery', 'carbon'][state.lpLines.length]; var target = pointSets[current];
                var match = target.filter(function (point) { return Math.abs(point[0] - x) <= 2 && Math.abs(point[1] - y) <= 2; })[0];
                var already = match && state.lpDraftPoints.some(function (point) { return point[0] === match[0] && point[1] === match[1]; });
                if (match && !already) { state.lpDraftPoints.push(match); state.lpPlotFeedback = state.lpDraftPoints.length === 2 ? 'Both points work. Draw the boundary line through them.' : 'Good point. Find one more point on the same boundary.'; }
                else state.lpPlotFeedback = already ? 'That point is already marked. Choose the second point.' : 'That point does not satisfy this equation. Recheck your substitution and try another grid intersection.';
                render(); return;
            }
            var inside = x >= 0 && y >= 0 && x <= 40 && y <= 30 && 2 * x + 4 * y <= 100 && 3 * x + 2 * y <= (state.scenario ? 68 : 90) && x + 2 * y <= 80;
            state.lpRegionMarked = inside;
            state.lpRegionFeedback = inside ? 'Correct — every point in this shared area respects all three limits.' : 'That point breaks at least one limit. Try the lower-left overlap below all boundary lines.';
            render();
        }); });
    }

    function updateLinearLive() {
        var results = root.querySelector('[data-linear-results]');
        if (!results) return;
        results.innerHTML = linearResults();
        bindLinearResultActions(results);
    }

    function calculusWorkspace() {
        tvFactory.currentX = state.tvX; tvFactory.currentY = state.tvY;
        var profit = workshopMath.profit(state.tvX, state.tvY, tvFactory);
        var slopeX = workshopMath.slopeX(state.tvX, state.tvY, tvFactory);
        var slopeY = workshopMath.slopeY(state.tvX, state.tvY, tvFactory);
        var peak = workshopMath.bestCombination(tvFactory);
        var coefficients = workshopMath.coefficients(tvFactory);
        var unlocked = Math.min(4, state.calcDone.length + 1);
        var rounds = ['Hill', 'Slope', 'Walk', 'Result'].map(function (label, index) {
            var number = index + 1; var done = state.calcDone.indexOf(number) >= 0; var locked = number > unlocked;
            return '<button data-calc-round="' + number + '" class="' + (state.calcRound === number ? 'is-active ' : '') + (done ? 'is-complete' : '') + '"' + (locked ? ' disabled title="Complete the previous round first"' : '') + '><span>' + (done ? '✓' : number) + '</span>' + label + '</button>';
        }).join('');
        var explanation = state.calcRound === 2
            ? 'Hold one TV model still. Each partial derivative is the change in profit from making one more unit of the other model.'
            : state.calcRound === 3 ? 'Move both production sliders. The green gradient arrow points uphill and shrinks as both partial derivatives approach zero.'
            : state.calcRound === 4 ? 'Compare today’s mix with the critical point where ∇P = 0. This is the maximum of the profit hill.'
            : 'Each colour band is a profit range: purple shows loss or low profit, green is stronger, and yellow marks the highest-profit area.';
        var model = '<section class="tella-math-model tella-tv-model"><span class="tella-eyebrow">UNDERLYING MODEL</span><h3>Profit function <em>P(s,t) = ' + coefficients.A + 's − ' + coefficients.B + 's² + ' + coefficients.C + 't − ' + coefficients.D + 't² − ' + coefficients.E + 'st − ' + coefficients.F.toLocaleString('en-IN') + '</em></h3><div class="tella-equation-key"><span><b>' + coefficients.A + 's and ' + coefficients.C + 't</b>unit contribution before demand effects</span><span><b>−' + coefficients.B + 's² and −' + coefficients.D + 't²</b>selling more lowers the achievable price</span><span><b>−' + coefficients.E + 'st</b>the two production lines compete for capacity</span><span><b>−' + coefficients.F.toLocaleString('en-IN') + '</b>daily fixed factory cost</span></div><p><b>∂P/∂s</b> = ' + coefficients.A + ' − ' + (2 * coefficients.B) + 's − ' + coefficients.E + 't = <span data-tv-model-x>' + slopeX.toFixed(2) + '</span> <small>profit change from one more 19-inch TV</small></p><p><b>∂P/∂t</b> = ' + coefficients.C + ' − ' + (2 * coefficients.D) + 't − ' + coefficients.E + 's = <span data-tv-model-y>' + slopeY.toFixed(2) + '</span> <small>profit change from one more 21-inch TV</small></p><p>s = 19-inch TVs · t = 21-inch TVs</p></section>';
        var chartHint = state.calc3d ? 'Drag to rotate · scroll to zoom · arrows show the two slopes' : (state.calcRound === 3 ? 'Follow the green arrow toward the blue target' : 'Colour shows profit from loss (purple) to peak (yellow)');
        var chartLabel = 'Profit landscape. Orange marks the current mix, a white point marks the maximum, and colours progress from purple loss areas to the yellow profit peak.' + (state.calcRound === 3 ? ' The green arrow shows the uphill direction.' : '');
        var slopeKey = state.calc3d ? '<span><i class="is-slope-s"></i>∂P/∂s slope</span><span><i class="is-slope-t"></i>∂P/∂t slope</span>' : (state.calcRound === 3 ? '<span><i class="is-gradient"></i>Uphill direction ∇P</span>' : '');
        var visual = '<div class="tella-calc-toolbar"><span>' + (state.calc3d ? 'Interactive 3D profit hill' : 'Profit contour map') + '<small>' + chartHint + '</small></span><div class="tella-view-actions">' + (state.calc3d ? '<button data-surface-reset>Reset view</button>' : '') + '<button data-calc-view>' + (state.calc3d ? 'Show contour map' : 'Show 3D hill') + '</button></div></div><div class="tella-contour tella-tv-canvas' + (state.calc3d ? ' is-interactive' : '') + '"><canvas data-tv-canvas width="720" height="410" role="img" aria-label="' + chartLabel + '"></canvas>' + (state.calc3d ? '<span class="tella-drag-cue" aria-hidden="true">↔ Drag to explore</span>' : '') + '</div><div class="tella-chart-key" aria-label="Chart legend"><span><i class="is-current"></i>Current mix</span><span><i class="is-best"></i>Maximum profit</span>' + slopeKey + '<span class="tella-heat-key"><i class="is-profit"></i><small>Loss</small><b>Profit level</b><small>Peak</small></span><span><i class="is-break-even"></i>Break-even (P = $0)</span></div>';
        if (state.calcRound === 2) {
            visual = '<div class="tella-calc-toolbar"><span>One-variable profit curve<small data-tv-frozen-copy>' + (state.calcFreeze === 'y' ? '21-inch production is fixed at ' + state.tvY : '19-inch production is fixed at ' + state.tvX) + '</small></span><div class="tella-freeze"><button data-calc-freeze="y" class="' + (state.calcFreeze === 'y' ? 'is-active' : '') + '">Hold t still</button><button data-calc-freeze="x" class="' + (state.calcFreeze === 'x' ? 'is-active' : '') + '">Hold s still</button></div></div><div class="tella-contour tella-tv-canvas"><canvas data-tv-slice width="720" height="340" role="img" aria-label="Profit curve with one television model held constant"></canvas></div><div class="tella-chart-key" aria-label="Chart legend"><span><i class="is-current"></i>Current mix</span><span><i class="is-curve"></i>Profit curve</span><span><i class="is-gradient"></i>Tangent shows current slope</span></div>';
        } else if (state.calcRound === 4) {
            var peakProfit = workshopMath.profit(peak.bestX, peak.bestY, tvFactory);
            visual = '<section class="tella-result" aria-label="Optimisation result"><span class="tella-eyebrow">FACTORY RECOMMENDATION</span><h3>Move production toward the critical point</h3><div><p><span>Today</span><b data-tv-current-mix>' + state.tvX + ' s · ' + state.tvY + ' t</b><small data-tv-current-profit>' + workshopMath.formatMoney(profit, '$') + '</small></p><strong>→</strong><p><span>Best mix</span><b>' + Math.round(peak.bestX) + ' s · ' + Math.round(peak.bestY) + ' t</b><small>' + workshopMath.formatMoney(peakProfit, '$') + '</small></p></div><p class="tella-result-gain">Potential daily gain: <b data-tv-gain>' + workshopMath.formatMoney(peakProfit - profit, '$') + '</b></p></section>';
        }
        var ready = roundReady(state.calcRound);
        var requirements = ['Rotate the 3D hill to inspect its shape.', 'Compare both one-variable slices by changing what is held still.', 'Move the production mix until both partial derivatives are close to zero.', 'Review the recommendation and potential gain.'];
        var roundFooter = '<div class="tella-round-footer"><div><b>' + (ready ? 'Round objective complete' : 'To continue') + '</b><span>' + requirements[state.calcRound - 1] + '</span></div><button class="tella-btn tella-btn--primary" data-round-complete' + (ready ? '' : ' disabled') + '>' + (state.calcRound === 4 ? 'Finish workshop' : 'Complete round & continue') + '</button></div>';
        return '<div class="tella-experiment-head"><div><span class="tella-eyebrow">APPROVED TV FACTORY WORKSHOP</span><h2>Two TV Models, One Profit Hill</h2></div>' + segment() + '</div>' +
            '<div class="tella-workshop-progress"><span><b>' + progressPercent() + '%</b> complete · ' + state.calcDone.length + ' of 4 rounds</span>' + progress(progressPercent(), 'Profit Hill workshop progress') + '</div><nav class="tella-calc-rounds" aria-label="Workshop rounds">' + rounds + '</nav><p class="tella-calc-mission">' + explanation + '</p>' +
            '<div class="tella-control-grid"><label>19-inch TVs (s) <output>' + state.tvX + '</output><input data-slider="tvX" type="range" min="0" max="9000" step="50" value="' + state.tvX + '" aria-label="19-inch TV production"></label><label>21-inch TVs (t) <output>' + state.tvY + '</output><input data-slider="tvY" type="range" min="0" max="9000" step="50" value="' + state.tvY + '" aria-label="21-inch TV production"></label></div>' +
            '<div class="tella-kpis tella-tv-kpis"><div><span>Profit P(s,t)</span><b data-tv-profit>' + workshopMath.formatMoney(profit, '$') + '</b></div><div><span>∂P/∂s</span><b data-tv-slope-x>' + slopeX.toFixed(2) + '</b></div><div><span>∂P/∂t</span><b data-tv-slope-y>' + slopeY.toFixed(2) + '</b></div><div><span>Best mix</span><b data-tv-best>' + Math.round(peak.bestX) + ' · ' + Math.round(peak.bestY) + '</b></div></div>' +
            (state.math ? model : visual) +
            '<div class="tella-feedback tella-feedback--info">' + icon('info') + '<div><b data-tv-status>' + (Math.abs(slopeX) < 2 && Math.abs(slopeY) < 2 ? 'You are at the top.' : slopeX > 0 || slopeY > 0 ? 'There is still an uphill direction.' : 'Production has moved beyond the peak.') + '</b><span data-tv-feedback>At this mix, one more 19-inch TV changes profit by ' + workshopMath.formatMoney(slopeX, '$') + '; one more 21-inch TV changes it by ' + workshopMath.formatMoney(slopeY, '$') + '.</span></div></div>' + roundFooter;
    }

    function updateCalculusLive() {
        tvFactory.currentX = state.tvX; tvFactory.currentY = state.tvY;
        var profit = workshopMath.profit(state.tvX, state.tvY, tvFactory);
        var slopeX = workshopMath.slopeX(state.tvX, state.tvY, tvFactory);
        var slopeY = workshopMath.slopeY(state.tvX, state.tvY, tvFactory);
        var peak = workshopMath.bestCombination(tvFactory);
        var peakProfit = workshopMath.profit(peak.bestX, peak.bestY, tvFactory);
        var values = {
            '[data-tv-profit]': workshopMath.formatMoney(profit, '$'),
            '[data-tv-slope-x]': slopeX.toFixed(2),
            '[data-tv-slope-y]': slopeY.toFixed(2),
            '[data-tv-best]': Math.round(peak.bestX) + ' · ' + Math.round(peak.bestY),
            '[data-tv-model-x]': slopeX.toFixed(2),
            '[data-tv-model-y]': slopeY.toFixed(2),
            '[data-tv-current-mix]': state.tvX + ' s · ' + state.tvY + ' t',
            '[data-tv-current-profit]': workshopMath.formatMoney(profit, '$'),
            '[data-tv-gain]': workshopMath.formatMoney(peakProfit - profit, '$'),
            '[data-tv-frozen-copy]': state.calcFreeze === 'y' ? '21-inch production is fixed at ' + state.tvY : '19-inch production is fixed at ' + state.tvX,
            '[data-tv-status]': Math.abs(slopeX) < 2 && Math.abs(slopeY) < 2 ? 'You are at the top.' : slopeX > 0 || slopeY > 0 ? 'There is still an uphill direction.' : 'Production has moved beyond the peak.',
            '[data-tv-feedback]': 'At this mix, one more 19-inch TV changes profit by ' + workshopMath.formatMoney(slopeX, '$') + '; one more 21-inch TV changes it by ' + workshopMath.formatMoney(slopeY, '$') + '.'
        };
        Object.keys(values).forEach(function (selector) {
            var element = root.querySelector(selector);
            if (element) element.textContent = values[selector];
        });
        updateRoundGate();
        if (!state.math && !calcFrame) {
            calcFrame = window.requestAnimationFrame(function () {
                calcFrame = null;
                drawCalculus();
            });
        }
    }

    function updateRoundGate() {
        var footer = root && root.querySelector('.tella-round-footer');
        if (!footer) return;
        var ready = roundReady(state.calcRound); var button = footer.querySelector('[data-round-complete]');
        var title = footer.querySelector('b');
        if (button) button.disabled = !ready;
        if (title) title.textContent = ready ? 'Round objective complete' : 'To continue';
    }

    function drawCalculus() {
        var canvas = root.querySelector('[data-tv-canvas]');
        tvFactory.currentX = state.tvX; tvFactory.currentY = state.tvY;
        var slice = root.querySelector('[data-tv-slice]');
        if (slice) {
            sizeCanvas(slice, true);
            chart3d.drawSlice(slice.getContext('2d'), tvFactory, state.calcFreeze,
                state.calcFreeze === 'y' ? state.tvY : state.tvX,
                state.calcFreeze === 'y' ? state.tvX : state.tvY, tvFactory.labels);
            return;
        }
        if (!canvas) return;
        sizeCanvas(canvas, false);
        var grid = tvGrid || (tvGrid = chart3d.buildGrid(tvFactory)); var peak = workshopMath.bestCombination(tvFactory);
        var extras = {labels: tvFactory.labels, peak: {x: peak.bestX, y: peak.bestY}, view: surfaceView,
            slopes: {x: workshopMath.slopeX(state.tvX, state.tvY, tvFactory), y: workshopMath.slopeY(state.tvX, state.tvY, tvFactory)}};
        if (state.calcRound === 3) extras.arrow = {
            dx: workshopMath.slopeX(state.tvX, state.tvY, tvFactory), dy: workshopMath.slopeY(state.tvX, state.tvY, tvFactory)
        };
        if (state.calc3d) chart3d.drawSurface(canvas.getContext('2d'), grid, {x: state.tvX, y: state.tvY}, extras);
        else chart3d.drawContour(canvas.getContext('2d'), grid, {x: state.tvX, y: state.tvY}, extras);
    }

    function sizeCanvas(canvas, isSlice) {
        var width = Math.max(280, Math.round(canvas.getBoundingClientRect().width || 720));
        var height = isSlice ? Math.min(340, Math.max(280, Math.round(width * 0.62))) : Math.min(410, Math.max(300, Math.round(width * 0.62)));
        if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width;
            canvas.height = height;
        }
    }

    function coach() {
        var calculus = state.skill === 'calculus';
        var actions = calculus
            ? ['Explain partial derivatives', 'Give me a calculus hint', 'Why do the slopes change?', 'Show a simpler example']
            : ['Explain this concept', 'Give me a hint', 'Why is this constraint failing?', 'Show a simpler example'];
        return '<aside class="tella-coach" aria-labelledby="coach-title"><div class="tella-coach-head"><span>' + icon('spark') + '</span><div><h2 id="coach-title">Tella Coach</h2><small>Academic guidance</small></div></div><p>Need a hint or want to understand what is happening?</p><div class="tella-coach-actions">' + actions.map(function (action) { return '<button data-coach="' + action + '">' + action + '</button>'; }).join('') + '</div><div class="tella-coach-message" data-coach-message aria-live="polite" hidden></div></aside>';
    }

    function workshop(skill) {
        var isLp = skill === 'linear';
        if (state.completed) return completion(skill);
        return '<main class="tella-workshop-player"><button class="tella-back" data-go="skill-' + skill + '">' + icon('back') + ' ' + labs[skill].title + '</button><header class="tella-workshop-header"><div><span>' + (isLp ? 'Production optimisation' : 'Multivariable profit modelling') + '</span><h1>' + (isLp ? 'Run the Clean-Energy Supply Chain' : 'Two TV Models, One Profit Hill') + '</h1></div><div><span>' + (isLp ? 'Step ' + state.lpStep + ' of 3' : 'Round ' + state.calcRound + ' of 4') + '</span><b>' + (850 + state.calcDone.length * 50) + ' XP</b></div></header><div class="tella-workshop-grid"><aside class="tella-mission"><span class="tella-eyebrow">YOUR MISSION</span><h2>' + (isLp ? 'Build a feasible production plan' : 'Find the top of the profit hill') + '</h2><p>' + (isLp ? 'You manage production for a European clean-energy technology company. Balance output while respecting available resources.' : 'A TV factory makes 19-inch and 21-inch models. Connect the business numbers to P(s,t), read each partial derivative, and walk toward maximum profit.') + '</p><div class="tella-objective"><span>Objective</span><b>' + (isLp ? 'Maximise quarterly profit' : 'Find the mix where ∇P = 0') + '</b></div><h3>Keep in mind</h3><ul><li>' + (isLp ? 'Labour hours' : '19-inch TVs: s') + '</li><li>' + (isLp ? 'Battery supply' : '21-inch TVs: t') + '</li><li>' + (isLp ? 'Carbon limit' : 'Both slopes together: ∇P') + '</li></ul><button class="tella-video-link" data-video>' + icon('play') + '<span><small>Need a refresher?</small>Watch supporting video</span></button></aside><section class="tella-experiment" aria-label="Interactive workspace">' + (isLp ? lpWorkspace() : calculusWorkspace()) + '</section>' + coach() + '</div></main>';
    }

    function completion(skill) {
        var calculus = skill === 'calculus';
        return '<main class="tella-workshop-player"><button class="tella-back" data-go="skill-' + skill + '">' + icon('back') + ' ' + labs[skill].title + '</button><section class="tella-completion"><span class="tella-completion-check">' + icon('check') + '</span><span class="tella-eyebrow">WORKSHOP COMPLETE</span><h1>' + (calculus ? 'You found the top of the profit hill.' : 'You balanced the decision successfully.') + '</h1><p>' + (calculus ? 'You connected partial derivatives, the gradient and the critical point to a business decision.' : 'You connected changing inputs with output, constraints and an efficient strategy.') + '</p><div class="tella-completion-xp">+250 XP</div><div class="tella-mastery-change"><span>Skill mastery</span><b>' + labs[skill].mastery + '% <i>→</i> ' + (labs[skill].mastery + 8) + '%</b>' + progress(labs[skill].mastery + 8, 'Updated skill mastery') + '</div><div class="tella-concepts"><h2>Concepts practised</h2><div>' + labs[skill].concepts.slice(0, 4).map(function (c) { return '<span>' + c + '</span>'; }).join('') + '</div></div><div class="tella-completion-actions"><button class="tella-btn tella-btn--primary" data-go="skill-' + skill + '">Continue Skill Lab</button><button class="tella-btn" data-review>Review My Strategy</button></div></section></main>';
    }

    function navigate(target) {
        if (target === 'home') { state.view = 'home'; }
        else if (target.indexOf('skill-') === 0) { state.view = 'skill'; state.skill = target.slice(6); }
        else if (target.indexOf('workshop-') === 0) { state.view = 'workshop'; state.skill = target.slice(9); }
        var url = new URL(window.location.href); url.searchParams.set('view', state.view); url.searchParams.set('skill', state.skill); window.history.pushState({}, '', url); render();
    }

    function openVideo() {
        var dialog = document.createElement('dialog');
        dialog.className = 'tella-video-dialog';
        var localVideo = state.skill === 'linear'
            ? {title: 'Linear Programming in Business', file: 'lpp.mp4'}
            : {title: 'Two Products, One Function', file: 'multi.mp4'};
        var source = new URL('./media.php?file=' + encodeURIComponent(localVideo.file), window.location.href).toString();
        dialog.innerHTML = '<button class="tella-dialog-close" aria-label="Close video">×</button><span class="tella-eyebrow">CONCEPT VIDEO</span><h2>' + localVideo.title + '</h2><div class="tella-video-stage"><video controls preload="metadata"><source src="' + source + '" type="video/mp4"></video></div>';
        document.body.appendChild(dialog);
        dialog.querySelector('.tella-dialog-close').addEventListener('click', function () { dialog.close(); });
        dialog.addEventListener('close', function () { dialog.remove(); });
        dialog.showModal();
    }

    function bind() {
        root.querySelectorAll('[data-go]').forEach(function (el) { el.addEventListener('click', function () { navigate(el.dataset.go); }); });
        root.querySelectorAll('[data-slider]').forEach(function (el) { el.addEventListener('input', function () {
            var key = el.dataset.slider;
            state[key] = Number(el.value);
            el.parentElement.querySelector('output').textContent = el.value;
            if (key === 'tvX' || key === 'tvY') {
                updateCalculusLive();
                return;
            }
            state.lpChoiceLocked = false;
            updateLinearLive();
        }); });
        root.querySelectorAll('[data-math]').forEach(function (el) { el.addEventListener('click', function () { state.math = el.dataset.math === 'true'; render(); }); });
        root.querySelectorAll('[data-lp-draw]').forEach(function (el) { el.addEventListener('click', function () { state.lpLines.push(el.dataset.lpDraw); state.lpDraftPoints = []; state.lpPlotFeedback = ''; render(); }); });
        root.querySelectorAll('[data-lp-show-points]').forEach(function (el) { el.addEventListener('click', function () {
            var pointSets = {labour: [[0, 25], [40, 5]], battery: [[10, 30], [30, 0]], carbon: [[20, 30], [40, 20]]};
            state.lpDraftPoints = pointSets[el.dataset.lpShowPoints];
            state.lpPlotFeedback = 'The two points are marked. Draw the line through them to continue.';
            render();
        }); });
        root.querySelectorAll('[data-lp-step]').forEach(function (el) { el.addEventListener('click', function () { state.lpStep = Number(el.dataset.lpStep); render(); }); });
        root.querySelectorAll('[data-lp-next]').forEach(function (el) { el.addEventListener('click', function () { state.lpStep += 1; render(); }); });
        root.querySelectorAll('[data-lp-choose]').forEach(function (el) { el.addEventListener('click', function () {
            var optimal = state.x === 20 && state.y === 15;
            state.lpChoiceLocked = optimal;
            state.lpChoiceFeedback = optimal ? 'Excellent — 20 EV units and 15 solar units earns €1,550k and uses the available battery supply exactly.' : 'This is not the best corner yet. Compare the feasible corner points; the best plan is where labour and battery boundaries meet.';
            if (optimal) state.scenario = false;
            render();
        }); });
        root.querySelectorAll('[data-coach]').forEach(function (el) { el.addEventListener('click', function () { var box = root.querySelector('[data-coach-message]'); var replies = {'Explain this concept': 'Try changing one variable at a time. Notice how the output and resource limits respond—this connects each decision variable to the model.', 'Give me a hint': 'Start from a feasible plan, then increase the product with the stronger profit contribution until a constraint approaches its limit.', 'Why is this constraint failing?': 'The selected mix consumes more of a resource than is available. The highlighted gauge identifies which limit to reduce.', 'Explain partial derivatives': '∂P/∂s holds t fixed and measures the profit change from one more 19-inch TV. ∂P/∂t does the same for one more 21-inch TV.', 'Give me a calculus hint': 'A positive partial derivative means increase that product; a negative one means reduce it. The peak is where both approach zero.', 'Why do the slopes change?': 'Higher output lowers the achievable selling price, and congestion makes each product affect the other. Those effects make both slopes shrink as production rises.', 'Show a simpler example': state.skill === 'calculus' ? 'Imagine a café selling tea and cake. Hold cake sales fixed and change tea sales: the resulting one-variable profit curve is a slice through the full profit hill.' : 'Imagine two products sharing one machine. Every unit uses some of the same limited machine time, so producing more of one leaves less capacity for the other.'}; box.hidden = false; box.innerHTML = '<b>' + el.dataset.coach + '</b><span>' + replies[el.dataset.coach] + '</span>'; }); });
        bindLinearResultActions(root);
        root.querySelectorAll('[data-review]').forEach(function (el) { el.addEventListener('click', function () { state.completed = false; render(); }); });
        root.querySelectorAll('[data-video]').forEach(function (el) { el.addEventListener('click', openVideo); });
        root.querySelectorAll('[data-calc-round]').forEach(function (el) { el.addEventListener('click', function () { state.calcRound = Number(el.dataset.calcRound); render(); }); });
        root.querySelectorAll('[data-calc-freeze]').forEach(function (el) { el.addEventListener('click', function () { if (state.calcFreeze !== el.dataset.calcFreeze) { state.freezeChanged = true; persistProgress(); } state.calcFreeze = el.dataset.calcFreeze; render(); }); });
        root.querySelectorAll('[data-calc-view]').forEach(function (el) { el.addEventListener('click', function () { state.calc3d = !state.calc3d; render(); }); });
        root.querySelectorAll('[data-round-complete]').forEach(function (el) { el.addEventListener('click', completeRound); });
        root.querySelectorAll('[data-surface-reset]').forEach(function (el) { el.addEventListener('click', function () {
            surfaceView.rotation = -0.72; surfaceView.elevation = 0.62; surfaceView.zoom = 1; drawCalculus();
        }); });
        var surface = root.querySelector('[data-tv-canvas]');
        if (surface && state.calc3d) bindSurfaceInteraction(surface);
        if (state.view === 'workshop' && state.skill === 'calculus' && !state.math) drawCalculus();
    }

    function bindSurfaceInteraction(canvas) {
        var drag = null;
        canvas.addEventListener('pointerdown', function (event) {
            drag = {x: event.clientX, y: event.clientY, rotation: surfaceView.rotation, elevation: surfaceView.elevation};
            canvas.setPointerCapture(event.pointerId); canvas.classList.add('is-dragging');
        });
        canvas.addEventListener('pointermove', function (event) {
            if (!drag) return;
            surfaceView.rotation = drag.rotation + (event.clientX - drag.x) * 0.009;
            surfaceView.elevation = Math.max(0.2, Math.min(1.12, drag.elevation - (event.clientY - drag.y) * 0.006));
            drawCalculus();
        });
        function stopDrag(event) {
            if (drag) { state.surfaceExplored = true; persistProgress(); updateRoundGate(); }
            drag = null; canvas.classList.remove('is-dragging');
            if (canvas.hasPointerCapture && canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
        }
        canvas.addEventListener('pointerup', stopDrag); canvas.addEventListener('pointercancel', stopDrag);
        canvas.addEventListener('wheel', function (event) {
            event.preventDefault(); surfaceView.zoom = Math.max(0.72, Math.min(1.55, surfaceView.zoom * (event.deltaY > 0 ? 0.92 : 1.08))); drawCalculus();
        }, {passive: false});
        canvas.addEventListener('keydown', function (event) {
            if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') surfaceView.rotation += event.key === 'ArrowLeft' ? -0.1 : 0.1;
            else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') surfaceView.elevation = Math.max(0.2, Math.min(1.12, surfaceView.elevation + (event.key === 'ArrowUp' ? 0.06 : -0.06)));
            else if (event.key === '+' || event.key === '=') surfaceView.zoom = Math.min(1.55, surfaceView.zoom * 1.08);
            else if (event.key === '-') surfaceView.zoom = Math.max(0.72, surfaceView.zoom * 0.92);
            else return;
            event.preventDefault(); state.surfaceExplored = true; persistProgress(); updateRoundGate(); drawCalculus();
        });
        canvas.tabIndex = 0;
    }

    function render() {
        root.innerHTML = state.view === 'home' ? home() : state.view === 'skill' ? skillLab(state.skill) : workshop(state.skill);
        bind();
    }

    function init(initConfig) {
        config = initConfig || {};
        root = document.getElementById('tella-workshop-root');
        if (!root) return;
        var params = new URLSearchParams(window.location.search); var view = params.get('view'); var skill = params.get('skill');
        if (['home', 'skill', 'workshop'].indexOf(view) >= 0) state.view = view;
        if (['linear', 'calculus'].indexOf(skill) >= 0) state.skill = skill;
        progressKey += '.' + ((config.user && (config.user.moodle_user_id || config.user.id)) || 'guest');
        if (state.skill === 'calculus') restoreProgress();
        window.addEventListener('popstate', function () { window.location.reload(); });
        window.addEventListener('resize', function () {
            if (state.view === 'workshop' && state.skill === 'calculus' && !state.math && !calcFrame) {
                calcFrame = window.requestAnimationFrame(function () { calcFrame = null; drawCalculus(); });
            }
        });
        workshopApi.flush(config.apiUrl, config.token);
        workshopApi.loadActivity(config.apiUrl, config.token, config.activityId).then(function (activity) {
            if (!activity) return null;
            activityId = activity.id || config.activityId;
            return workshopApi.loadProgress(config.apiUrl, config.token, activityId);
        }).then(function (remote) {
            if (!remote) return;
            var remoteDone = remote.extra && remote.extra.completed_rounds;
            if (Array.isArray(remoteDone) && remoteDone.length > state.calcDone.length) {
                state.calcDone = remoteDone.filter(function (n) { return n <= 4; }); state.calcRound = Math.min(4, state.calcDone.length + 1);
            }
            if (state.skill === 'calculus' && (String(remote.status).toLowerCase() === 'completed' || Number(remote.progress_percentage) >= 100)) state.completed = true;
            if (state.skill === 'calculus') persistProgress();
            render();
        });
        render();
    }
    return {init: init};
});
