define([
    'local_tella_workshop/api',
    'local_tella_workshop/geogebra',
    'local_tella_workshop/placeholder'
], function (api, geogebra, placeholder) {
    function stringFor(strings, key, fallback) {
        return strings && strings[key] ? strings[key] : fallback;
    }

    function appendText(documentRef, parent, tagName, className, text) {
        if (!text) {
            return null;
        }
        var element = documentRef.createElement(tagName);
        element.className = className;
        element.textContent = text;
        parent.appendChild(element);
        return element;
    }

    function createDomView(root, strings) {
        var documentRef = root.ownerDocument || document;
        var status = null;

        function showMessage(message, kind) {
            root.textContent = '';
            var panel = documentRef.createElement('div');
            panel.className = 'tella-system-message tella-system-message-' + kind;
            panel.setAttribute('role', kind === 'error' ? 'alert' : 'status');
            panel.textContent = message;
            root.appendChild(panel);
        }

        return {
            showLoading: function () {
                showMessage(stringFor(strings, 'loading', 'Loading activity…'), 'loading');
            },
            showError: function (message) {
                showMessage(message, 'error');
            },
            showActivity: function (activity, experiment) {
                root.textContent = '';
                var article = documentRef.createElement('article');
                article.className = 'tella-experiment-app';
                var header = documentRef.createElement('header');
                header.className = 'tella-experiment-header';
                appendText(
                    documentRef,
                    header,
                    'p',
                    'tella-experiment-type',
                    String(experiment.experiment_type || activity.activity_type || '').replaceAll('_', ' ')
                );
                appendText(documentRef, header, 'h2', 'tella-experiment-title', activity.title);
                appendText(documentRef, header, 'p', 'tella-experiment-description', activity.description);
                status = appendText(
                    documentRef,
                    header,
                    'p',
                    'tella-experiment-status',
                    stringFor(strings, 'online', 'Connected for progress tracking.')
                );
                if (status) {
                    status.setAttribute('role', 'status');
                    status.setAttribute('aria-live', 'polite');
                }
                article.appendChild(header);

                if (experiment.instructions) {
                    var instructions = documentRef.createElement('section');
                    instructions.className = 'tella-instructions';
                    appendText(
                        documentRef,
                        instructions,
                        'h3',
                        'tella-section-title',
                        stringFor(strings, 'instructions', 'Instructions')
                    );
                    appendText(documentRef, instructions, 'p', 'tella-instructions-copy', experiment.instructions);
                    article.appendChild(instructions);
                }

                var host = documentRef.createElement('div');
                host.className = 'tella-renderer-host';
                article.appendChild(host);
                root.appendChild(article);
                return host;
            },
            setStatus: function (message) {
                if (status) {
                    status.textContent = message;
                }
            }
        };
    }

    function createRunner(options) {
        var client = options.api;
        var adapters = options.adapters;
        var view = options.view;
        var strings = options.strings || {};
        var isOnline = options.isOnline || function () { return navigator.onLine; };
        var cleanup = null;
        var mounted = false;

        function destroy() {
            if (typeof cleanup === 'function') {
                cleanup();
            }
            cleanup = null;
            mounted = false;
        }

        function reportProgress(config, activity, update) {
            return client.saveProgress(config.apiUrl, config.token, {
                activity: activity.id,
                status: update.status || 'in_progress',
                progress_percentage: update.progress_percentage || 0,
                extra: {
                    experiment: {
                        schema_version: activity.experiment.configuration.schema_version,
                        renderer: activity.experiment.configuration.renderer,
                        state: update.state || {}
                    }
                }
            });
        }

        function mount(config, activity) {
            var experiment = activity && activity.experiment;
            var definition = experiment && experiment.configuration;
            if (!definition || typeof definition.renderer !== 'string') {
                view.showError(stringFor(strings, 'configurationMissing', 'This activity has no published experiment definition.'));
                return Promise.resolve(null);
            }
            var adapter = adapters[definition.renderer];
            if (!adapter) {
                view.showError(stringFor(strings, 'rendererUnsupported', 'This experiment renderer is not supported by this installation.'));
                return Promise.resolve(null);
            }

            destroy();
            var host = view.showActivity(activity, experiment);
            var context = {
                strings: strings,
                setStatus: view.setStatus,
                reportProgress: function (update) {
                    return reportProgress(config, activity, update);
                }
            };
            reportProgress(config, activity, {
                status: 'in_progress',
                progress_percentage: 0,
                state: {opened: true}
            });
            return Promise.resolve(adapter.mount(host, definition, context)).then(function (adapterCleanup) {
                cleanup = adapterCleanup;
                mounted = true;
                return activity;
            }).catch(function () {
                mounted = false;
                view.showError(stringFor(strings, 'rendererFailed', 'The interactive activity could not be loaded. Check your connection and try again.'));
                return null;
            });
        }

        function start(config) {
            view.showLoading();
            if (!config.apiUrl || !config.token) {
                view.showError(stringFor(strings, 'authenticationRequired', 'Sign in through Moodle to load and track this activity.'));
                return Promise.resolve(null);
            }
            if (!isOnline()) {
                view.showError(stringFor(strings, 'onlineRequired', 'An internet connection is required to load this activity and track progress.'));
                return Promise.resolve(null);
            }
            client.flush(config.apiUrl, config.token);
            return client.loadActivity(config.apiUrl, config.token, config.activityId).then(function (activity) {
                if (!activity) {
                    view.showError(stringFor(strings, 'activityUnavailable', 'No published experiment is available for this learner.'));
                    return null;
                }
                return mount(config, activity);
            }).catch(function () {
                view.showError(stringFor(strings, 'activityUnavailable', 'No published experiment is available for this learner.'));
                return null;
            });
        }

        return {start: start, destroy: destroy, isMounted: function () { return mounted; }};
    }

    function init(config) {
        var root = document.getElementById('tella-workshop-root');
        if (!root || root.getAttribute('data-runner-mounted') === 'true') {
            return;
        }
        root.setAttribute('data-runner-mounted', 'true');
        var runner = createRunner({
            api: api,
            adapters: {geogebra: geogebra, placeholder: placeholder},
            view: createDomView(root, config.strings || {}),
            strings: config.strings || {}
        });
        runner.start(config);

        function onOnline() {
            api.flush(config.apiUrl, config.token);
            if (!runner.isMounted()) {
                runner.start(config);
            }
        }
        window.addEventListener('online', onOnline);
        window.addEventListener('beforeunload', function () {
            window.removeEventListener('online', onOnline);
            runner.destroy();
        }, {once: true});
    }

    return {init: init, createRunner: createRunner};
});
