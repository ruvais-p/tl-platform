define(['local_tella_workshop/api'], function (api) {
    function addText(documentRef, parent, tagName, className, text) {
        var element = documentRef.createElement(tagName);
        element.className = className;
        element.textContent = text || '';
        parent.appendChild(element);
        return element;
    }

    function safeUrl(value, windowRef) {
        if (typeof value !== 'string' || !value.trim()) {
            return '';
        }
        try {
            var parsed = new windowRef.URL(value, windowRef.location.href);
            return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : '';
        } catch (ignore) {
            return '';
        }
    }

    function render(root, state) {
        var documentRef = root.ownerDocument || document;
        var windowRef = documentRef.defaultView || window;
        var strings = state.strings || {};
        var status = root.querySelector('[data-role="status"]');
        var list = root.querySelector('[data-role="list"]');
        if (!state.apiUrl || !state.token) {
            status.textContent = strings.authenticationRequired || 'Sign in through Moodle to load opportunities.';
            return Promise.resolve([]);
        }
        return api.loadCareers(state.apiUrl, state.token).then(function (items) {
            if (!items || !items.length) {
                return;
            }
            status.hidden = true;
            list.textContent = '';
            items.forEach(function (item) {
                var card = documentRef.createElement('article');
                card.className = 'tella-careers-card';
                addText(documentRef, card, 'h3', 'tella-careers-title', item.title);
                addText(documentRef, card, 'p', 'tella-careers-kind', (item.kind || '').replace(/_/g, ' '));
                addText(documentRef, card, 'p', 'tella-careers-summary', item.summary);
                var url = safeUrl(item.url, windowRef);
                if (url) {
                    var link = addText(
                        documentRef,
                        card,
                        'a',
                        'tella-careers-link',
                        strings.openDetails || 'Open details'
                    );
                    link.href = url;
                    link.rel = 'noopener noreferrer';
                }
                list.appendChild(card);
            });
        });
    }

    function init(cfg) {
        var root = document.getElementById('tella-careers-root');
        if (!root) {
            return;
        }
        return render(root, {apiUrl: cfg.apiUrl, token: cfg.token, strings: cfg.strings || {}});
    }

    return {init: init, render: render};
});
