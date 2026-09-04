define([], function () {
    var EPSILON = 0.0000001;
    var instanceCount = 0;

    function object(value) {
        return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    }

    function finite(value, fallback) {
        var parsed = typeof value === 'number' ? value : Number(value);
        return isFinite(parsed) ? parsed : fallback;
    }

    function text(value, fallback) {
        return typeof value === 'string' && value.trim() ? value.trim() : fallback;
    }

    function identifier(value) {
        return typeof value === 'string' && /^[A-Za-z][A-Za-z0-9_]*$/.test(value) ? value : '';
    }

    function parseWorkspace(value) {
        var source = object(value);
        var errors = [];
        if (source.type !== 'linear_programming') {
            return {workspace: null, errors: ['workspace.type must be linear_programming.']};
        }

        var rawVariables = Array.isArray(source.variables) ? source.variables : [];
        if (rawVariables.length < 2) {
            errors.push('workspace.variables must contain at least two variables.');
        }
        var variables = [];
        var ids = {};
        rawVariables.forEach(function (entry, index) {
            var item = object(entry);
            var id = identifier(item.id);
            if (!id || ids[id]) {
                errors.push('workspace.variables[' + index + '].id must be unique and safe.');
                return;
            }
            var minimum = finite(item.min, NaN);
            var maximum = finite(item.max, NaN);
            var step = finite(item.step, 1);
            var initial = finite(item.initial, minimum);
            if (![minimum, maximum, step, initial].every(isFinite) || minimum >= maximum || step <= 0) {
                errors.push('workspace variable ' + id + ' has invalid numeric limits.');
                return;
            }
            ids[id] = true;
            variables.push({
                id: id,
                label: text(item.label, id),
                symbol: text(item.symbol, id),
                unit: text(item.unit, 'units'),
                min: minimum,
                max: maximum,
                step: step,
                initial: Math.max(minimum, Math.min(maximum, initial))
            });
        });

        var axes = Array.isArray(source.axis_variables) ? source.axis_variables.map(identifier) : [];
        if (axes.length !== 2 || axes[0] === axes[1] || !ids[axes[0]] || !ids[axes[1]]) {
            errors.push('workspace.axis_variables must identify two different variables.');
        }

        var objectiveSource = object(source.objective);
        var objectiveCoefficients = object(objectiveSource.coefficients);
        if (variables.some(function (variable) { return !isFinite(finite(objectiveCoefficients[variable.id], NaN)); })) {
            errors.push('workspace.objective.coefficients must include every variable.');
        }
        var constraints = [];
        var constraintIds = {};
        (Array.isArray(source.constraints) ? source.constraints : []).forEach(function (entry, index) {
            var item = object(entry);
            var id = identifier(item.id);
            var coefficients = object(item.coefficients);
            if (!id || constraintIds[id] || (item.operator !== '<=' && item.operator !== '>=') ||
                    !isFinite(finite(item.rhs, NaN)) || variables.some(function (variable) {
                        return !isFinite(finite(coefficients[variable.id], NaN));
                    })) {
                errors.push('workspace.constraints[' + index + '] is invalid.');
                return;
            }
            constraintIds[id] = true;
            constraints.push({
                id: id,
                label: text(item.label, id),
                coefficients: coefficients,
                operator: item.operator,
                rhs: finite(item.rhs, 0)
            });
        });
        if (!constraints.length) {
            errors.push('workspace.constraints must contain at least one constraint.');
        }
        if (errors.length) {
            return {workspace: null, errors: errors};
        }

        return {
            errors: [],
            workspace: {
                type: 'linear_programming',
                title: text(source.title, 'Linear programming workspace'),
                problemStatement: text(source.problem_statement, 'Explore the feasible region and best allocation.'),
                axisVariables: axes,
                variables: variables,
                constraints: constraints,
                objective: {
                    label: text(objectiveSource.label, 'Objective value'),
                    sense: objectiveSource.sense === 'minimize' ? 'minimize' : 'maximize',
                    currency: typeof objectiveSource.currency === 'string' ? objectiveSource.currency : '',
                    coefficients: objectiveCoefficients
                }
            }
        };
    }

    function initialState(workspace) {
        var state = {
            variableValues: {},
            objectiveCoefficients: {},
            constraintCoefficients: {},
            constraintRhs: {},
            variableBounds: {},
            plotted: false
        };
        workspace.variables.forEach(function (variable) {
            state.variableValues[variable.id] = variable.initial;
            state.objectiveCoefficients[variable.id] = finite(workspace.objective.coefficients[variable.id], 0);
            state.variableBounds[variable.id] = {min: variable.min, max: variable.max};
        });
        workspace.constraints.forEach(function (constraint) {
            state.constraintCoefficients[constraint.id] = {};
            workspace.variables.forEach(function (variable) {
                state.constraintCoefficients[constraint.id][variable.id] = finite(constraint.coefficients[variable.id], 0);
            });
            state.constraintRhs[constraint.id] = constraint.rhs;
        });
        return state;
    }

    function intersection(left, right) {
        var determinant = left.a * right.b - right.a * left.b;
        if (Math.abs(determinant) < EPSILON) {
            return null;
        }
        return {
            x: (left.rhs * right.b - right.rhs * left.b) / determinant,
            y: (left.a * right.rhs - right.a * left.rhs) / determinant
        };
    }

    function satisfies(point, boundary) {
        var value = boundary.a * point.x + boundary.b * point.y;
        return boundary.operator === '<=' ? value <= boundary.rhs + EPSILON : value >= boundary.rhs - EPSILON;
    }

    function solve(workspace, state) {
        var xId = workspace.axisVariables[0];
        var yId = workspace.axisVariables[1];
        var xBounds = state.variableBounds[xId];
        var yBounds = state.variableBounds[yId];
        var labels = {};
        workspace.variables.forEach(function (variable) { labels[variable.id] = variable.label; });
        var boundaries = [
            {id: xId + '_min', label: labels[xId] + ' minimum', a: 1, b: 0, rhs: xBounds.min, operator: '>='},
            {id: xId + '_max', label: labels[xId] + ' maximum', a: 1, b: 0, rhs: xBounds.max, operator: '<='},
            {id: yId + '_min', label: labels[yId] + ' minimum', a: 0, b: 1, rhs: yBounds.min, operator: '>='},
            {id: yId + '_max', label: labels[yId] + ' maximum', a: 0, b: 1, rhs: yBounds.max, operator: '<='}
        ];

        workspace.constraints.forEach(function (constraint) {
            var coefficients = state.constraintCoefficients[constraint.id];
            var fixed = workspace.variables.reduce(function (sum, variable) {
                return variable.id === xId || variable.id === yId ? sum :
                    sum + coefficients[variable.id] * state.variableValues[variable.id];
            }, 0);
            boundaries.push({
                id: constraint.id,
                label: constraint.label,
                a: coefficients[xId],
                b: coefficients[yId],
                rhs: state.constraintRhs[constraint.id] - fixed,
                operator: constraint.operator
            });
        });

        var points = [];
        boundaries.forEach(function (left, leftIndex) {
            boundaries.slice(leftIndex + 1).forEach(function (right) {
                var point = intersection(left, right);
                if (point && boundaries.every(function (boundary) { return satisfies(point, boundary); }) &&
                        !points.some(function (candidate) {
                            return Math.abs(candidate.x - point.x) < 0.00001 && Math.abs(candidate.y - point.y) < 0.00001;
                        })) {
                    points.push(point);
                }
            });
        });
        if (points.length < 3) {
            return {ok: false, message: 'These values do not create a bounded feasible region.', vertices: [],
                boundaries: boundaries, area: 0, best: null, allocation: {}, objectiveConstant: 0};
        }

        var center = points.reduce(function (total, point) {
            return {x: total.x + point.x / points.length, y: total.y + point.y / points.length};
        }, {x: 0, y: 0});
        points.sort(function (left, right) {
            return Math.atan2(left.y - center.y, left.x - center.x) - Math.atan2(right.y - center.y, right.x - center.x);
        });
        var start = points.reduce(function (best, point, index) {
            var current = points[best];
            return point.y < current.y - EPSILON ||
                (Math.abs(point.y - current.y) < EPSILON && point.x < current.x) ? index : best;
        }, 0);
        points = points.slice(start).concat(points.slice(0, start));

        var objectiveConstant = workspace.variables.reduce(function (sum, variable) {
            return variable.id === xId || variable.id === yId ? sum :
                sum + state.objectiveCoefficients[variable.id] * state.variableValues[variable.id];
        }, 0);
        var vertices = points.map(function (point, index) {
            return {
                x: point.x,
                y: point.y,
                label: 'V' + (index + 1),
                objectiveValue: state.objectiveCoefficients[xId] * point.x +
                    state.objectiveCoefficients[yId] * point.y + objectiveConstant
            };
        });
        var ranked = vertices.slice().sort(function (left, right) { return left.objectiveValue - right.objectiveValue; });
        var best = workspace.objective.sense === 'maximize' ? ranked[ranked.length - 1] : ranked[0];
        var allocation = {};
        workspace.variables.forEach(function (variable) {
            allocation[variable.id] = variable.id === xId ? best.x :
                variable.id === yId ? best.y : state.variableValues[variable.id];
        });
        var twiceArea = vertices.reduce(function (sum, point, index) {
            var next = vertices[(index + 1) % vertices.length];
            return sum + point.x * next.y - next.x * point.y;
        }, 0);
        return {
            ok: true,
            message: 'Feasible region calculated.',
            vertices: vertices,
            boundaries: boundaries,
            area: Math.abs(twiceArea) / 2,
            best: best,
            allocation: allocation,
            objectiveConstant: objectiveConstant
        };
    }

    function clear(element) {
        while (element.firstChild) {
            element.removeChild(element.firstChild);
        }
    }

    function node(documentRef, tagName, className, content) {
        var element = documentRef.createElement(tagName);
        if (className) {
            element.className = className;
        }
        if (content !== undefined && content !== null) {
            element.textContent = content;
        }
        return element;
    }

    function append(parent, children) {
        children.filter(Boolean).forEach(function (child) { parent.appendChild(child); });
        return parent;
    }

    function formatNumber(value) {
        if (!isFinite(value)) {
            return '—';
        }
        var rounded = Math.abs(value - Math.round(value)) < 0.00000001 ? Math.round(value) : Number(value.toFixed(2));
        return rounded.toLocaleString('en-IN', {maximumFractionDigits: 2});
    }

    function formatMoney(value, currency) {
        return currency + Number(value).toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2});
    }

    function expression(coefficients, workspace) {
        return workspace.variables.map(function (variable, index) {
            var coefficient = coefficients[variable.id];
            var sign = coefficient < 0 ? '−' : index === 0 ? '' : '+';
            return sign + (index > 0 && sign === '+' ? ' ' : '') + formatNumber(Math.abs(coefficient)) + variable.symbol;
        }).join(' ');
    }

    function panel(documentRef, title, description) {
        var container = node(documentRef, 'section', 'tella-lp-panel');
        append(container, [
            node(documentRef, 'h3', 'tella-lp-panel-title', title),
            description ? node(documentRef, 'p', 'tella-lp-panel-description', description) : null
        ]);
        return container;
    }

    function numericInput(documentRef, label, value, step, changed) {
        var field = node(documentRef, 'label', 'tella-lp-field');
        field.appendChild(node(documentRef, 'span', 'tella-lp-field-label', label));
        var input = node(documentRef, 'input', 'tella-lp-input');
        input.type = 'number';
        input.step = step || 'any';
        input.value = String(value);
        input.addEventListener('change', function () {
            var next = finite(input.value, value);
            input.value = String(next);
            changed(next);
        });
        field.appendChild(input);
        return field;
    }

    function renderTable(documentRef, headers, rows) {
        var wrapper = node(documentRef, 'div', 'tella-lp-table-wrap');
        var table = node(documentRef, 'table', 'tella-lp-table');
        var head = node(documentRef, 'thead');
        var headRow = node(documentRef, 'tr');
        headers.forEach(function (heading) { headRow.appendChild(node(documentRef, 'th', '', heading)); });
        head.appendChild(headRow);
        table.appendChild(head);
        var body = node(documentRef, 'tbody');
        rows.forEach(function (values) {
            var row = node(documentRef, 'tr');
            values.forEach(function (value) { row.appendChild(node(documentRef, 'td', '', value)); });
            body.appendChild(row);
        });
        table.appendChild(body);
        wrapper.appendChild(table);
        return wrapper;
    }

    function commandNumber(value) {
        return Number(value.toFixed(10)).toString();
    }

    function draw(applet, workspace, state, solution) {
        if (!applet || typeof applet.evalCommand !== 'function') {
            return;
        }
        applet.reset();
        if (applet.setPerspective) {
            applet.setPerspective('G');
        }
        if (applet.setAxesVisible) {
            applet.setAxesVisible(1, true, true, false);
        }
        if (applet.setGridVisible) {
            applet.setGridVisible(1, true);
        }
        if (!solution.ok) {
            return;
        }
        var xValues = solution.vertices.map(function (point) { return point.x; });
        var yValues = solution.vertices.map(function (point) { return point.y; });
        var xMin = Math.min.apply(Math, xValues);
        var xMax = Math.max.apply(Math, xValues);
        var yMin = Math.min.apply(Math, yValues);
        var yMax = Math.max.apply(Math, yValues);
        var xPad = Math.max(2, (xMax - xMin) * 0.2);
        var yPad = Math.max(2, (yMax - yMin) * 0.2);
        if (applet.setCoordSystem) {
            applet.setCoordSystem(xMin - xPad, xMax + xPad, yMin - yPad, yMax + yPad);
        }

        var feasibleRegion = solution.boundaries.map(function (boundary) {
            return '(' + commandNumber(boundary.a) + '*x+' + commandNumber(boundary.b) + '*y' +
                boundary.operator + commandNumber(boundary.rhs) + ')';
        }).join('&&');
        applet.evalCommand('TellaFeasible=' + feasibleRegion);
        if (applet.setColor) {
            applet.setColor('TellaFeasible', 37, 99, 235);
        }
        if (applet.setFilling) {
            applet.setFilling('TellaFeasible', 0.22);
        }
        if (applet.setLabelVisible) {
            applet.setLabelVisible('TellaFeasible', false);
        }

        solution.boundaries.forEach(function (boundary, index) {
            if (Math.abs(boundary.a) < EPSILON && Math.abs(boundary.b) < EPSILON) {
                return;
            }
            var name = 'TellaBoundary' + (index + 1);
            applet.evalCommand(name + ':' + commandNumber(boundary.a) + '*x+' +
                commandNumber(boundary.b) + '*y=' + commandNumber(boundary.rhs));
            if (applet.setColor) {
                applet.setColor(name, index < 4 ? 108 : 205, index < 4 ? 116 : 74, index < 4 ? 130 : 96);
            }
            if (applet.setLineThickness) {
                applet.setLineThickness(name, index < 4 ? 2 : 4);
            }
            if (applet.setCaption) {
                applet.setCaption(name, boundary.label);
            }
        });
        solution.vertices.forEach(function (vertex, index) {
            var name = 'TellaVertex' + (index + 1);
            applet.evalCommand(name + '=(' + commandNumber(vertex.x) + ',' + commandNumber(vertex.y) + ')');
            if (applet.setColor) {
                applet.setColor(name, 35, 76, 190);
            }
            if (applet.setPointSize) {
                applet.setPointSize(name, 5);
            }
            if (applet.setCaption) {
                applet.setCaption(name, vertex.label);
            }
            if (applet.setLabelVisible) {
                applet.setLabelVisible(name, true);
            }
        });
        if (solution.best) {
            var xId = workspace.axisVariables[0];
            var yId = workspace.axisVariables[1];
            var xCoefficient = state.objectiveCoefficients[xId];
            var yCoefficient = state.objectiveCoefficients[yId];
            var level = solution.best.objectiveValue - solution.objectiveConstant;
            if (Math.abs(xCoefficient) > EPSILON || Math.abs(yCoefficient) > EPSILON) {
                applet.evalCommand('TellaObjective:' + commandNumber(xCoefficient) + '*x+' +
                    commandNumber(yCoefficient) + '*y=' + commandNumber(level));
                if (applet.setColor) {
                    applet.setColor('TellaObjective', 21, 128, 90);
                }
                if (applet.setLineThickness) {
                    applet.setLineThickness('TellaObjective', 5);
                }
            }
        }
    }

    function createAdapter(options) {
        options = options || {};
        var windowRef = options.window || window;
        var documentRef = options.document || document;
        var loadScript = options.loadScript;
        var setTimeoutRef = options.setTimeout || windowRef.setTimeout.bind(windowRef);
        var clearTimeoutRef = options.clearTimeout || windowRef.clearTimeout.bind(windowRef);

        return {
            mount: function (host, definition, context) {
                var parsed = parseWorkspace(object(definition.renderer_config).workspace);
                if (!parsed.workspace) {
                    return Promise.reject(new Error(parsed.errors.join(' ')));
                }
                if (typeof loadScript !== 'function') {
                    return Promise.reject(new Error('GeoGebra loader is unavailable.'));
                }
                var workspace = parsed.workspace;
                var state = initialState(workspace);
                var solution = solve(workspace, state);
                var applet = null;
                var disposed = false;
                var resizeObserver = null;
                var root = node(documentRef, 'div', 'tella-lp-workspace');
                var toolbar = node(documentRef, 'div', 'tella-lp-toolbar');
                var title = node(documentRef, 'div');
                append(title, [
                    node(documentRef, 'p', 'tella-lp-eyebrow', 'GeoGebra workspace · 2D slice'),
                    node(documentRef, 'p', 'tella-lp-data-note', 'This problem was loaded from the published experiment record.')
                ]);
                var actions = node(documentRef, 'div', 'tella-lp-actions');
                var calculate = node(documentRef, 'button', 'tella-lp-button tella-lp-button-primary', 'Calculate & plot');
                var reset = node(documentRef, 'button', 'tella-lp-button', 'Reset');
                var fullscreen = node(documentRef, 'button', 'tella-lp-button', 'Fullscreen');
                [calculate, reset, fullscreen].forEach(function (button) { button.type = 'button'; actions.appendChild(button); });
                append(toolbar, [title, actions]);
                root.appendChild(toolbar);

                var workbench = node(documentRef, 'div', 'tella-lp-workbench');
                var layout = node(documentRef, 'div', 'tella-lp-layout');
                var left = node(documentRef, 'div', 'tella-lp-column');
                var problem = panel(documentRef, workspace.title, workspace.problemStatement);
                var model = node(documentRef, 'div', 'tella-lp-model');
                problem.appendChild(model);
                left.appendChild(problem);
                var controls = panel(documentRef, 'Model controls', 'Change assumptions and observe how the feasible region responds.');
                var controlsBody = node(documentRef, 'div', 'tella-lp-controls');
                controls.appendChild(controlsBody);
                left.appendChild(controls);

                var plotPanel = panel(documentRef, 'Feasible region', 'The graph is rebuilt through the GeoGebra API.');
                plotPanel.classList.add('tella-lp-plot-panel');
                var plotFrame = node(documentRef, 'div', 'tella-geogebra-frame tella-lp-plot');
                var target = node(documentRef, 'div', 'tella-geogebra-target');
                target.id = 'tella-lp-geogebra-' + (++instanceCount);
                plotFrame.appendChild(target);
                plotPanel.appendChild(plotFrame);
                var results = node(documentRef, 'div', 'tella-lp-results');
                var summary = node(documentRef, 'div', 'tella-lp-summary');
                append(workbench, [plotPanel, left]);
                root.appendChild(workbench);
                append(layout, [results, summary]);
                root.appendChild(layout);
                host.appendChild(root);

                function syncFullscreen() {
                    var active = documentRef.fullscreenElement === root;
                    root.classList.toggle('is-fullscreen', active);
                    fullscreen.textContent = active ? 'Exit fullscreen' : 'Fullscreen';
                    fullscreen.setAttribute('aria-pressed', active ? 'true' : 'false');
                }

                function removeFullscreenListener() {
                    if (documentRef.removeEventListener) {
                        documentRef.removeEventListener('fullscreenchange', syncFullscreen);
                    }
                }

                if (documentRef.addEventListener) {
                    documentRef.addEventListener('fullscreenchange', syncFullscreen);
                }
                syncFullscreen();

                function refreshModel() {
                    clear(model);
                    model.appendChild(node(documentRef, 'p', '',
                        (workspace.objective.sense === 'maximize' ? 'Maximize ' : 'Minimize ') +
                        'Z = ' + expression(state.objectiveCoefficients, workspace)));
                    workspace.constraints.forEach(function (constraint) {
                        model.appendChild(node(documentRef, 'p', '', expression(state.constraintCoefficients[constraint.id], workspace) +
                            ' ' + (constraint.operator === '<=' ? '≤' : '≥') + ' ' + formatNumber(state.constraintRhs[constraint.id]) +
                            ' (' + constraint.label + ')'));
                    });
                    model.appendChild(node(documentRef, 'p', '', workspace.variables.map(function (variable) {
                        var bounds = state.variableBounds[variable.id];
                        return formatNumber(bounds.min) + ' ≤ ' + variable.symbol + ' ≤ ' + formatNumber(bounds.max);
                    }).join(', ')));
                }

                function refreshResults() {
                    clear(results);
                    clear(summary);
                    if (!solution.ok || !solution.best) {
                        var warning = panel(documentRef, 'No feasible polygon', solution.message);
                        warning.classList.add('tella-lp-panel-error');
                        results.appendChild(warning);
                        return;
                    }
                    var resultPanel = panel(documentRef, 'Feasible vertices', 'Area ' + formatNumber(solution.area) + ' square units');
                    resultPanel.appendChild(renderTable(documentRef, ['Vertex', 'Coordinates', 'Z value'],
                        solution.vertices.map(function (vertex) {
                            return [vertex.label, '(' + formatNumber(vertex.x) + ', ' + formatNumber(vertex.y) + ')',
                                formatMoney(vertex.objectiveValue, workspace.objective.currency)];
                        })));
                    results.appendChild(resultPanel);
                    var best = panel(documentRef,
                        workspace.objective.sense === 'maximize' ? 'Best allocation' : 'Lowest-cost allocation',
                        workspace.variables.map(function (variable) {
                            return variable.label + ': ' + formatNumber(solution.allocation[variable.id]);
                        }).join(' · '));
                    best.classList.add('tella-lp-panel-success');
                    best.appendChild(node(documentRef, 'p', 'tella-lp-best-value', workspace.objective.label + ': ' +
                        formatMoney(solution.best.objectiveValue, workspace.objective.currency)));
                    results.appendChild(best);

                    var summaryPanel = panel(documentRef, 'Model formulation summary', 'Current values used in this calculation.');
                    var headers = ['Constraint'].concat(workspace.variables.map(function (variable) { return variable.label; }), ['Total']);
                    var rows = workspace.constraints.map(function (constraint) {
                        return [constraint.label].concat(workspace.variables.map(function (variable) {
                            return formatNumber(state.constraintCoefficients[constraint.id][variable.id]);
                        }), [(constraint.operator === '<=' ? '≤ ' : '≥ ') + formatNumber(state.constraintRhs[constraint.id])]);
                    });
                    rows.push([workspace.objective.label + ' contribution'].concat(workspace.variables.map(function (variable) {
                        return formatNumber(state.objectiveCoefficients[variable.id]);
                    }), ['—']));
                    summaryPanel.appendChild(renderTable(documentRef, headers, rows));
                    summary.appendChild(summaryPanel);
                }

                function recalculate() {
                    solution = solve(workspace, state);
                    refreshModel();
                    refreshResults();
                    draw(applet, workspace, state, solution);
                }

                function renderControls() {
                    clear(controlsBody);
                    var xId = workspace.axisVariables[0];
                    var yId = workspace.axisVariables[1];
                    var parameters = workspace.variables.filter(function (variable) {
                        return variable.id !== xId && variable.id !== yId;
                    });
                    if (parameters.length) {
                        controlsBody.appendChild(node(documentRef, 'h4', 'tella-lp-control-title', 'Fixed product parameters'));
                        parameters.forEach(function (variable) {
                            var field = node(documentRef, 'label', 'tella-lp-field');
                            var output = node(documentRef, 'span', 'tella-lp-slider-output',
                                formatNumber(state.variableValues[variable.id]) + ' ' + variable.unit);
                            append(field, [node(documentRef, 'span', 'tella-lp-field-label', variable.label + ' (' + variable.symbol + ')'), output]);
                            var input = node(documentRef, 'input', 'tella-lp-range');
                            input.type = 'range';
                            input.min = String(state.variableBounds[variable.id].min);
                            input.max = String(state.variableBounds[variable.id].max);
                            input.step = String(variable.step);
                            input.value = String(state.variableValues[variable.id]);
                            input.addEventListener('input', function () {
                                state.variableValues[variable.id] = finite(input.value, state.variableValues[variable.id]);
                                output.textContent = formatNumber(state.variableValues[variable.id]) + ' ' + variable.unit;
                                recalculate();
                            });
                            field.appendChild(input);
                            controlsBody.appendChild(field);
                        });
                    }

                    controlsBody.appendChild(node(documentRef, 'h4', 'tella-lp-control-title', 'Objective function'));
                    var objectiveGrid = node(documentRef, 'div', 'tella-lp-input-grid');
                    workspace.variables.forEach(function (variable) {
                        objectiveGrid.appendChild(numericInput(documentRef, variable.symbol + ' (' + variable.label + ')',
                            state.objectiveCoefficients[variable.id], 'any', function (value) {
                                state.objectiveCoefficients[variable.id] = value;
                                recalculate();
                            }));
                    });
                    controlsBody.appendChild(objectiveGrid);

                    controlsBody.appendChild(node(documentRef, 'h4', 'tella-lp-control-title', 'Resource constraints'));
                    workspace.constraints.forEach(function (constraint) {
                        var card = node(documentRef, 'fieldset', 'tella-lp-control-card');
                        card.appendChild(node(documentRef, 'legend', 'tella-lp-field-label', constraint.label));
                        var grid = node(documentRef, 'div', 'tella-lp-input-grid');
                        workspace.variables.forEach(function (variable) {
                            grid.appendChild(numericInput(documentRef, variable.symbol,
                                state.constraintCoefficients[constraint.id][variable.id], 'any', function (value) {
                                    state.constraintCoefficients[constraint.id][variable.id] = value;
                                    recalculate();
                                }));
                        });
                        grid.appendChild(numericInput(documentRef, 'Total', state.constraintRhs[constraint.id], 'any', function (value) {
                            state.constraintRhs[constraint.id] = value;
                            recalculate();
                        }));
                        card.appendChild(grid);
                        controlsBody.appendChild(card);
                    });

                    controlsBody.appendChild(node(documentRef, 'h4', 'tella-lp-control-title', 'Product bounds'));
                    workspace.variables.forEach(function (variable) {
                        var row = node(documentRef, 'div', 'tella-lp-bound-row');
                        row.appendChild(node(documentRef, 'p', 'tella-lp-bound-label', variable.label + ' · ' + variable.unit));
                        row.appendChild(numericInput(documentRef, 'Minimum', state.variableBounds[variable.id].min, variable.step,
                            function (value) {
                                state.variableBounds[variable.id].min = Math.min(value,
                                    state.variableBounds[variable.id].max - variable.step);
                                state.variableValues[variable.id] = Math.max(state.variableValues[variable.id],
                                    state.variableBounds[variable.id].min);
                                renderControls();
                                recalculate();
                            }));
                        row.appendChild(numericInput(documentRef, 'Maximum', state.variableBounds[variable.id].max, variable.step,
                            function (value) {
                                state.variableBounds[variable.id].max = Math.max(value,
                                    state.variableBounds[variable.id].min + variable.step);
                                state.variableValues[variable.id] = Math.min(state.variableValues[variable.id],
                                    state.variableBounds[variable.id].max);
                                renderControls();
                                recalculate();
                            }));
                        controlsBody.appendChild(row);
                    });
                }

                calculate.addEventListener('click', function () {
                    state.plotted = true;
                    recalculate();
                    if (solution.ok && solution.best) {
                        context.reportProgress({
                            status: 'completed',
                            progress_percentage: 100,
                            state: {
                                linear_programming: state,
                                best_allocation: solution.allocation,
                                objective_value: solution.best.objectiveValue
                            }
                        });
                        context.setStatus(context.strings.completionSaved || 'Completion saved.');
                    }
                });
                reset.addEventListener('click', function () {
                    state = initialState(workspace);
                    renderControls();
                    recalculate();
                });
                fullscreen.addEventListener('click', function () {
                    if (documentRef.fullscreenElement === root && documentRef.exitFullscreen) {
                        documentRef.exitFullscreen();
                    } else if (root.requestFullscreen) {
                        root.requestFullscreen();
                    }
                });

                renderControls();
                recalculate();
                context.setStatus(context.strings.geogebraLoading || 'Loading interactive mathematics…');
                return loadScript().then(function (GGBApplet) {
                    return new Promise(function (resolve, reject) {
                        var timeout = setTimeoutRef(function () {
                            reject(new Error('GeoGebra timed out while loading the workspace.'));
                        }, 20000);
                        var config = object(definition.renderer_config);
                        var configured = object(config.parameters);
                        var parameters = {};
                        Object.keys(configured).forEach(function (key) {
                            if (key !== 'appletOnLoad' && key !== 'material_id' &&
                                    key !== 'scaleContainerClass' && key !== 'autoHeight') {
                                parameters[key] = configured[key];
                            }
                        });
                        parameters.appName = text(config.app_name, 'graphing');
                        parameters.width = Math.max(1, Math.round(plotFrame.clientWidth || finite(config.width, 900)));
                        parameters.height = Math.max(1, Math.round(plotFrame.clientHeight || finite(config.height, 620)));
                        parameters.showToolBar = false;
                        parameters.showMenuBar = false;
                        parameters.showAlgebraInput = false;
                        parameters.perspective = 'G';
                        parameters.enableRightClick = false;
                        parameters.appletOnLoad = function (api) {
                            clearTimeoutRef(timeout);
                            if (disposed) {
                                resolve(function () {});
                                return;
                            }
                            applet = api;
                            draw(applet, workspace, state, solution);
                            if (typeof windowRef.ResizeObserver === 'function' && applet.setSize) {
                                var fittedWidth = parameters.width;
                                var fittedHeight = parameters.height;
                                resizeObserver = new windowRef.ResizeObserver(function () {
                                    if (disposed || !applet) {
                                        return;
                                    }
                                    var width = Math.max(1, Math.round(plotFrame.clientWidth));
                                    var height = Math.max(1, Math.round(plotFrame.clientHeight));
                                    if (width === fittedWidth && height === fittedHeight) {
                                        return;
                                    }
                                    fittedWidth = width;
                                    fittedHeight = height;
                                    applet.setSize(width, height);
                                    if (applet.recalculateEnvironments) {
                                        applet.recalculateEnvironments();
                                    }
                                });
                                resizeObserver.observe(plotFrame);
                            }
                            context.setStatus(context.strings.interactiveReady || 'Interactive activity ready.');
                            resolve(function () {
                                disposed = true;
                                removeFullscreenListener();
                                if (resizeObserver) {
                                    resizeObserver.disconnect();
                                    resizeObserver = null;
                                }
                                if (root.parentNode === host) {
                                    host.removeChild(root);
                                }
                                applet = null;
                            });
                        };
                        try {
                            new GGBApplet(parameters, true).inject(target.id);
                        } catch (error) {
                            clearTimeoutRef(timeout);
                            reject(error);
                        }
                    });
                }).catch(function (error) {
                    disposed = true;
                    removeFullscreenListener();
                    if (resizeObserver) {
                        resizeObserver.disconnect();
                        resizeObserver = null;
                    }
                    if (root.parentNode === host) {
                        host.removeChild(root);
                    }
                    throw error;
                });
            }
        };
    }

    return {createAdapter: createAdapter, parseWorkspace: parseWorkspace, initialState: initialState, solve: solve};
});
