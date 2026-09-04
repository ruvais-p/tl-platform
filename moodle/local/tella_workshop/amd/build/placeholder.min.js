define([], function () {
    function addText(documentRef, parent, tagName, className, text) {
        if (!text) {
            return null;
        }
        var element = documentRef.createElement(tagName);
        element.className = className;
        element.textContent = text;
        parent.appendChild(element);
        return element;
    }

    function mount(host, definition, context) {
        var documentRef = host.ownerDocument || document;
        var config = definition.renderer_config || {};
        var panel = documentRef.createElement('section');
        panel.className = 'tella-placeholder';
        panel.setAttribute('role', 'status');
        addText(documentRef, panel, 'h3', 'tella-placeholder-title', config.heading || '');
        addText(documentRef, panel, 'p', 'tella-placeholder-message', config.message || definition.instructions || '');
        addText(documentRef, panel, 'p', 'tella-placeholder-note', config.note || '');
        host.appendChild(panel);
        context.setStatus(context.strings.placeholderReady || 'Activity information loaded.');

        return function () {
            if (panel.parentNode === host) {
                host.removeChild(panel);
            }
        };
    }

    return {mount: mount};
});
