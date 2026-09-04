define(['local_tella_workshop/linear_programming'], function (linearProgramming) {
    var DEPLOY_SCRIPT = 'https://www.geogebra.org/apps/deployggb.js';
    var instanceCount = 0;
    var sharedScriptPromise = null;

    function loadDeployScript(documentRef, windowRef) {
        if (windowRef.GGBApplet) {
            return Promise.resolve(windowRef.GGBApplet);
        }
        if (sharedScriptPromise) {
            return sharedScriptPromise;
        }

        sharedScriptPromise = new Promise(function (resolve, reject) {
            var existing = documentRef.querySelector('script[data-tella-geogebra]');
            var script = existing || documentRef.createElement('script');
            function loaded() {
                if (windowRef.GGBApplet) {
                    resolve(windowRef.GGBApplet);
                } else {
                    sharedScriptPromise = null;
                    reject(new Error('GeoGebra did not expose GGBApplet.'));
                }
            }
            function failed() {
                sharedScriptPromise = null;
                reject(new Error('GeoGebra could not be loaded.'));
            }
            script.addEventListener('load', loaded, {once: true});
            script.addEventListener('error', failed, {once: true});
            if (!existing) {
                script.src = DEPLOY_SCRIPT;
                script.async = true;
                script.setAttribute('data-tella-geogebra', 'true');
                documentRef.head.appendChild(script);
            }
        });
        return sharedScriptPromise;
    }

    function numeric(value, fallback) {
        return typeof value === 'number' && isFinite(value) && value > 0 ? value : fallback;
    }

    function buildParameters(config, onLoad) {
        var parameters = {};
        var configured = config.parameters || {};
        Object.keys(configured).forEach(function (key) {
            if (key !== 'appletOnLoad') {
                parameters[key] = configured[key];
            }
        });
        parameters.appName = config.app_name || 'graphing';
        parameters.material_id = config.material_id;
        parameters.width = numeric(config.width, 960);
        parameters.height = numeric(config.height, 600);
        parameters.scaleContainerClass = 'tella-geogebra-frame';
        parameters.autoHeight = true;
        parameters.appletOnLoad = onLoad;
        return parameters;
    }

    function readObject(applet, name) {
        try {
            var value = applet.getValue(name);
            if (typeof value === 'number' && isFinite(value)) {
                return value;
            }
        } catch (ignoreNumeric) {
            // Some GeoGebra object types do not expose a numeric value.
        }
        try {
            var text = applet.getValueString(name);
            return typeof text === 'string' ? text : null;
        } catch (ignoreText) {
            return null;
        }
    }

    function comparable(value) {
        if (typeof value === 'boolean') {
            return value ? 1 : 0;
        }
        return value;
    }

    function isComplete(actual, rule) {
        if (!rule) {
            return false;
        }
        var left = comparable(actual);
        var right = comparable(rule.value);
        switch (rule.operator) {
            case 'truthy': return Boolean(left);
            case 'equals': return left === right;
            case 'not_equals': return left !== right;
            case 'greater_than': return left > right;
            case 'greater_than_or_equal': return left >= right;
            case 'less_than': return left < right;
            case 'less_than_or_equal': return left <= right;
            default: return false;
        }
    }

    function startTracking(applet, definition, context, timers) {
        var tracking = definition.tracking;
        if (!tracking) {
            return null;
        }
        var names = (tracking.watch_objects || []).slice();
        if (tracking.progress_object) {
            names.push(tracking.progress_object);
        }
        if (tracking.completion && tracking.completion.object) {
            names.push(tracking.completion.object);
        }
        names = names.filter(function (name, index) {
            return names.indexOf(name) === index;
        });
        if (!names.length) {
            return null;
        }

        var lastSnapshot = '';
        var completed = false;
        var interval = null;
        function poll() {
            var values = {};
            names.forEach(function (name) {
                values[name] = readObject(applet, name);
            });
            var complete = isComplete(
                tracking.completion ? values[tracking.completion.object] : null,
                tracking.completion
            );
            var rawProgress = tracking.progress_object ? values[tracking.progress_object] : 0;
            var progress = typeof rawProgress === 'number' ? Math.max(0, Math.min(100, rawProgress)) : 0;
            if (complete) {
                progress = 100;
            }
            var snapshot = JSON.stringify({values: values, progress: progress, complete: complete});
            if (snapshot !== lastSnapshot) {
                lastSnapshot = snapshot;
                var saved = context.reportProgress({
                    status: complete ? 'completed' : 'in_progress',
                    progress_percentage: progress,
                    state: {values: values}
                });
                if (complete) {
                    Promise.resolve(saved).then(function (response) {
                        if (response) {
                            context.setStatus(context.strings.completionSaved || 'Completion saved.');
                        }
                    });
                }
            }
            completed = complete;
            if (completed && interval !== null) {
                timers.clearInterval(interval);
                interval = null;
            }
        }

        poll();
        if (completed) {
            return null;
        }
        interval = timers.setInterval(poll, tracking.throttle_ms || 1000);
        return interval;
    }

    function createAdapter(options) {
        options = options || {};
        var windowRef = options.window || window;
        var documentRef = options.document || document;
        var loadScript = options.loadScript || function () {
            return loadDeployScript(documentRef, windowRef);
        };
        var timers = {
            setInterval: options.setInterval || windowRef.setInterval.bind(windowRef),
            clearInterval: options.clearInterval || windowRef.clearInterval.bind(windowRef),
            setTimeout: options.setTimeout || windowRef.setTimeout.bind(windowRef),
            clearTimeout: options.clearTimeout || windowRef.clearTimeout.bind(windowRef)
        };
        var workspaceAdapter = linearProgramming.createAdapter({
            window: windowRef,
            document: documentRef,
            loadScript: loadScript,
            setTimeout: timers.setTimeout,
            clearTimeout: timers.clearTimeout
        });
        return {
            mount: function (host, definition, context) {
                var config = definition.renderer_config || {};
                if (config.workspace && config.workspace.type === 'linear_programming') {
                    return workspaceAdapter.mount(host, definition, context);
                }
                var disposed = false;
                var trackingTimer = null;
                var applet = null;
                var target = documentRef.createElement('div');
                var targetId = 'tella-geogebra-' + (++instanceCount);
                target.id = targetId;
                target.className = 'tella-geogebra-target';
                host.classList.add('tella-geogebra-frame');
                host.appendChild(target);
                context.setStatus(context.strings.geogebraLoading || 'Loading interactive mathematics…');

                return loadScript().then(function (GGBApplet) {
                    return new Promise(function (resolve, reject) {
                        var timeout = timers.setTimeout(function () {
                            reject(new Error('GeoGebra timed out while loading the material.'));
                        }, 20000);
                        function onLoad(api) {
                            timers.clearTimeout(timeout);
                            if (disposed) {
                                resolve(function () {});
                                return;
                            }
                            applet = api;
                            trackingTimer = startTracking(api, definition, context, timers);
                            context.setStatus(context.strings.interactiveReady || 'Interactive activity ready.');
                            resolve(function () {
                                disposed = true;
                                if (trackingTimer !== null) {
                                    timers.clearInterval(trackingTimer);
                                }
                                if (target.parentNode === host) {
                                    host.removeChild(target);
                                }
                                applet = null;
                            });
                        }
                        try {
                            var parameters = buildParameters(config, onLoad);
                            var deployment = new GGBApplet(parameters, true);
                            deployment.inject(targetId);
                        } catch (error) {
                            timers.clearTimeout(timeout);
                            reject(error);
                        }
                    });
                }).catch(function (error) {
                    disposed = true;
                    if (target.parentNode === host) {
                        host.removeChild(target);
                    }
                    throw error;
                });
            }
        };
    }

    var defaultAdapter = createAdapter();
    return {mount: defaultAdapter.mount, createAdapter: createAdapter};
});
