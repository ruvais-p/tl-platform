define([], function () {
    var queueKey = 'tella.progressQueue';

    function loadQueue() {
        try {
            return JSON.parse(localStorage.getItem(queueKey) || '[]');
        } catch (e) {
            return [];
        }
    }

    function saveQueue(items) {
        localStorage.setItem(queueKey, JSON.stringify(items));
    }

    function headers(token) {
        var h = {'Content-Type': 'application/json'};
        if (token) {
            h.Authorization = 'Bearer ' + token;
        }
        return h;
    }

    function request(apiUrl, token, path, options) {
        options = options || {};
        return fetch(apiUrl + path, {
            method: options.method || 'GET',
            headers: headers(token),
            body: options.body ? JSON.stringify(options.body) : undefined
        }).then(function (res) {
            if (!res.ok) {
                throw new Error('HTTP ' + res.status);
            }
            return res.json();
        });
    }

    function hasExperimentDefinition(activity) {
        return Boolean(
            activity && activity.experiment && activity.experiment.configuration &&
            typeof activity.experiment.configuration.renderer === 'string' &&
            activity.experiment.configuration.renderer
        );
    }

    function findExperimentActivity(response) {
        var programs = Array.isArray(response) ? response : (response && response.results) || [];
        var p;
        var c;
        var ch;
        var st;
        var a;
        var version;
        for (p = 0; p < programs.length; p++) {
            var courses = programs[p].courses || [];
            for (c = 0; c < courses.length; c++) {
                version = courses[c].published_version;
                if (!version) {
                    continue;
                }
                var chapters = version.chapters || [];
                for (ch = 0; ch < chapters.length; ch++) {
                    var subs = chapters[ch].subtopics || [];
                    for (st = 0; st < subs.length; st++) {
                        var acts = subs[st].activities || [];
                        for (a = 0; a < acts.length; a++) {
                            if (hasExperimentDefinition(acts[a])) {
                                return acts[a];
                            }
                        }
                    }
                }
            }
        }
        return null;
    }

    function loadActivity(apiUrl, token, activityId) {
        if (!apiUrl || !token) {
            return Promise.resolve(null);
        }
        if (activityId) {
            return request(apiUrl, token, '/api/v1/activities/' + activityId + '/').catch(function () {
                return null;
            });
        }
        return request(apiUrl, token, '/api/v1/programs/').then(function (programs) {
            return findExperimentActivity(programs);
        }).catch(function () {
            return null;
        });
    }

    function enqueue(item) {
        var q = loadQueue();
        q.push(item);
        saveQueue(q);
    }

    function flush(apiUrl, token) {
        if (!apiUrl || !token || !navigator.onLine) {
            return Promise.resolve();
        }
        var q = loadQueue();
        if (!q.length) {
            return Promise.resolve();
        }
        var failed = [];
        var next = Promise.resolve();
        q.forEach(function (item) {
            next = next.then(function () {
                return request(apiUrl, token, item.path, {method: item.method, body: item.body});
            }).catch(function () {
                failed.push(item);
                return null;
            });
        });
        return next.then(function () {
            saveQueue(failed);
        });
    }

    function saveProgress(apiUrl, token, body) {
        if (!apiUrl || !token || !navigator.onLine) {
            enqueue({path: '/api/v1/progress/', method: 'POST', body: body});
            return Promise.resolve(null);
        }
        return request(apiUrl, token, '/api/v1/progress/', {method: 'POST', body: body}).catch(function () {
            enqueue({path: '/api/v1/progress/', method: 'POST', body: body});
            return null;
        });
    }

    function loadCareers(apiUrl, token) {
        if (!apiUrl || !token) {
            return Promise.resolve([]);
        }
        return request(apiUrl, token, '/api/v1/career/opportunities/').catch(function () {
            return [];
        });
    }

    return {
        loadActivity: loadActivity,
        saveProgress: saveProgress,
        flush: flush,
        loadCareers: loadCareers
    };
});
