(function () {
    'use strict';

    if (window.__jellyfinAdvancedBooksIntegrationLoaded) return;
    window.__jellyfinAdvancedBooksIntegrationLoaded = true;

    const replaceNativeReader = window.__advancedBooksReplaceNativeReader === true;
    let popstateClosing = false;
    let tokenSequence = 0;

    function getCurrentItemId() {
        const directId = new URLSearchParams(window.location.search).get('id');
        if (directId) return directId;

        const hash = window.location.hash || '';
        const questionIndex = hash.indexOf('?');
        if (questionIndex >= 0) {
            const hashId = new URLSearchParams(hash.slice(questionIndex + 1)).get('id');
            if (hashId) return hashId;
        }

        const match = hash.match(/[?&]id=([^&]+)/i);
        return match ? decodeURIComponent(match[1]) : null;
    }

    function ensureStyles() {
        if (document.getElementById('advancedBooksReaderIntegrationStyles')) return;
        const style = document.createElement('style');
        style.id = 'advancedBooksReaderIntegrationStyles';
        style.textContent = `
.advancedBooksReaderNavButton{padding:0!important}
.advancedBooksReaderNavButton svg{display:block;width:1.35rem;height:1.35rem;pointer-events:none}
.advancedBooksReaderCounter{display:none!important}
.advancedBooksReaderButton.ab-native-reader-replaced{display:none!important}
`;
        document.head.appendChild(style);
    }

    function makeChevron(direction) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('aria-hidden', 'true');
        svg.setAttribute('focusable', 'false');

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', direction === 'left' ? 'M15 18l-6-6 6-6' : 'M9 6l6 6-6 6');
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', 'currentColor');
        path.setAttribute('stroke-width', '2.25');
        path.setAttribute('stroke-linecap', 'round');
        path.setAttribute('stroke-linejoin', 'round');
        svg.appendChild(path);
        return svg;
    }

    function decorateNavigation(overlay) {
        const navigationButtons = Array.from(overlay.querySelectorAll('.advancedBooksReaderNavButton'));
        const previous = overlay.querySelector('button[data-ab-action="previous"]') ?? navigationButtons[0] ?? null;
        const next = overlay.querySelector('button[data-ab-action="next"]') ?? navigationButtons[navigationButtons.length - 1] ?? null;

        if (previous && previous.dataset.abSvgIcon !== 'true') {
            previous.replaceChildren(makeChevron('left'));
            previous.dataset.abSvgIcon = 'true';
        }
        if (next && next.dataset.abSvgIcon !== 'true') {
            next.replaceChildren(makeChevron('right'));
            next.dataset.abSvgIcon = 'true';
        }
    }

    function pushReaderHistory(overlay) {
        if (overlay.dataset.abHistoryToken) return;

        const token = `advanced-books-${Date.now().toString(36)}-${++tokenSequence}`;
        overlay.dataset.abHistoryToken = token;

        try {
            const current = history.state && typeof history.state === 'object' ? history.state : {};
            history.pushState({ ...current, __advancedBooksReader: token }, '', window.location.href);
            overlay.dataset.abHistoryOwned = 'true';
        } catch {
            overlay.dataset.abHistoryOwned = 'false';
        }

        overlay.addEventListener('advancedbooks:reader-closing', () => {
            if (popstateClosing) {
                popstateClosing = false;
                return;
            }

            if (overlay.dataset.abHistoryOwned !== 'true') return;
            if (history.state?.__advancedBooksReader !== token) return;
            window.setTimeout(() => history.back(), 0);
        }, { once: true });
    }

    function decorateOverlay(overlay) {
        if (!(overlay instanceof HTMLElement)) return;
        ensureStyles();
        decorateNavigation(overlay);
        pushReaderHistory(overlay);
    }

    function refreshNativeReplacement() {
        if (!replaceNativeReader) return;
        const itemId = getCurrentItemId();

        document.querySelectorAll('.advancedBooksReaderButton').forEach(button => {
            const sameItem = !itemId || button.dataset.advancedBooksItemId === itemId;
            const host = button.closest('.mainDetailButtons');
            const nativeAction = host?.querySelector('.btnPlay:not(.hide),.btnReplay:not(.hide)');
            button.classList.toggle('ab-native-reader-replaced', Boolean(sameItem && nativeAction));
        });
    }

    function getAdvancedButton(itemId) {
        return Array.from(document.querySelectorAll('.advancedBooksReaderButton'))
            .find(button => button.dataset.advancedBooksItemId === itemId)
            ?? null;
    }

    document.addEventListener('click', event => {
        if (!replaceNativeReader) return;

        const nativeButton = event.target?.closest?.('.mainDetailButtons .btnPlay,.mainDetailButtons .btnReplay');
        if (!nativeButton) return;

        const itemId = getCurrentItemId();
        if (!itemId) return;

        const advancedButton = getAdvancedButton(itemId);
        if (!advancedButton) return;

        event.preventDefault();
        event.stopImmediatePropagation();

        const startMode = nativeButton.classList.contains('btnReplay')
            || nativeButton.getAttribute('data-action') === 'play'
            ? 'start'
            : 'resume';

        advancedButton.dataset.advancedBooksStartMode = startMode;
        advancedButton.click();
        queueMicrotask(() => {
            if (advancedButton.dataset.advancedBooksStartMode === startMode) {
                advancedButton.dataset.advancedBooksStartMode = 'resume';
            }
        });
    }, true);

    window.addEventListener('popstate', event => {
        const overlay = document.querySelector('.advancedBooksReaderOverlay');
        if (!overlay) return;

        const token = overlay.dataset.abHistoryToken;
        if (token && event.state?.__advancedBooksReader === token) return;

        const reader = overlay.__advancedBooksReaderSession;
        if (!reader || typeof reader.close !== 'function') return;

        popstateClosing = true;
        reader.close();
    });

    const observer = new MutationObserver(records => {
        for (const record of records) {
            for (const node of record.addedNodes) {
                if (!(node instanceof Element)) continue;
                if (node.matches?.('.advancedBooksReaderOverlay')) decorateOverlay(node);
                node.querySelectorAll?.('.advancedBooksReaderOverlay').forEach(decorateOverlay);
            }
        }
        refreshNativeReplacement();
    });

    observer.observe(document.documentElement, { childList: true, subtree: true });
    document.querySelectorAll('.advancedBooksReaderOverlay').forEach(decorateOverlay);
    refreshNativeReplacement();
})();
