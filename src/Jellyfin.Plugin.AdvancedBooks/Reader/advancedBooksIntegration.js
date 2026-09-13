(function () {
    'use strict';

    if (window.__jellyfinAdvancedBooksIntegrationLoaded) return;
    window.__jellyfinAdvancedBooksIntegrationLoaded = true;

    const replaceNativeReader = window.__advancedBooksReplaceNativeReader === true;
    const nativePlaybackSelector = [
        '.mainDetailButtons .btnPlay',
        '.mainDetailButtons .btnReplay',
        '.btnPlayOrResume',
        '[data-action="play"]',
        '[data-action="resume"]'
    ].join(',');
    const contextSourceSelector = '.itemAction[data-action="menu"],[data-action="menu"].itemAction,.btnMoreCommands';
    const bypassClicks = new WeakSet();
    const bypassCommands = new WeakSet();
    let popstateClosing = false;
    let tokenSequence = 0;
    let contextTarget = null;

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

    function getReaderApi() {
        const api = window.AdvancedBooksReader;
        return api && typeof api.openItem === 'function' ? api : null;
    }

    function detailAction(element) {
        return Boolean(element?.closest?.(
            '.mainDetailButtons,.itemDetailPage,.itemDetailsPage'
        ) || element?.matches?.('.btnPlayOrResume,.btnReplay,.btnPlay,.btnMoreCommands'));
    }

    function findItemCarrier(element) {
        if (!(element instanceof Element)) return null;
        if (element.hasAttribute('data-id')) return element;
        return element.closest('[data-id]');
    }

    function resolveItemId(element) {
        const carrier = findItemCarrier(element);
        const id = carrier?.getAttribute('data-id');
        if (id) return id;
        return detailAction(element) ? getCurrentItemId() : null;
    }

    function isKnownNonBook(element) {
        const carrier = findItemCarrier(element);
        const type = carrier?.getAttribute('data-type') ?? carrier?.getAttribute('data-itemtype');
        return Boolean(type && type.toLowerCase() !== 'book');
    }

    function startModeForAction(element, action) {
        if (element?.classList?.contains('btnReplay')) return 'start';
        if (action === 'resume') return 'resume';
        if (detailAction(element)) return 'start';

        // Generic card/list/remote Play can outlive a UserData update in the DOM.
        // Resume from Jellyfin's authoritative shared UserItemData instead; when no
        // position is stored the progress bridge naturally opens page 1.
        return 'resume';
    }

    async function openAdvancedItem(itemId, startMode) {
        const api = getReaderApi();
        if (!api || !itemId) return false;
        try {
            return await api.openItem(itemId, startMode) === true;
        } catch {
            return false;
        }
    }

    function replayClick(element) {
        if (!(element instanceof HTMLElement)) return;
        bypassClicks.add(element);
        try {
            element.click();
        } finally {
            queueMicrotask(() => bypassClicks.delete(element));
        }
    }

    function replayCommand(element, command) {
        if (!(element instanceof EventTarget)) return;
        bypassCommands.add(element);
        try {
            element.dispatchEvent(new CustomEvent('command', {
                detail: { command },
                bubbles: true,
                cancelable: true
            }));
        } finally {
            queueMicrotask(() => bypassCommands.delete(element));
        }
    }

    function rememberContextTarget(element) {
        if (isKnownNonBook(element)) {
            contextTarget = null;
            return;
        }
        const itemId = resolveItemId(element);
        if (!itemId) {
            contextTarget = null;
            return;
        }

        contextTarget = {
            itemId,
            createdAt: Date.now()
        };
    }

    async function handleNativeClick(event) {
        if (!replaceNativeReader) return;
        const target = event.target instanceof Element ? event.target : null;
        if (!target) return;

        const contextSource = target.closest(contextSourceSelector);
        if (contextSource) {
            rememberContextTarget(contextSource);
            return;
        }

        const actionSheetItem = target.closest('.actionSheetMenuItem[data-id="play"],.actionSheetMenuItem[data-id="resume"]');
        if (actionSheetItem && contextTarget && Date.now() - contextTarget.createdAt < 30000) {
            const state = contextTarget;
            contextTarget = null;

            event.preventDefault();
            event.stopImmediatePropagation();

            const command = actionSheetItem.getAttribute('data-id') === 'resume' ? 'resume' : 'play';
            const opened = await openAdvancedItem(
                state.itemId,
                command === 'resume' ? 'resume' : 'start'
            );
            if (!opened) {
                replayClick(actionSheetItem);
                return;
            }

            const originalId = actionSheetItem.getAttribute('data-id');
            actionSheetItem.setAttribute('data-id', '__advancedbooks_handled__');
            replayClick(actionSheetItem);
            queueMicrotask(() => {
                if (originalId) actionSheetItem.setAttribute('data-id', originalId);
            });
            return;
        }

        const nativeAction = target.closest(nativePlaybackSelector);
        if (!nativeAction || bypassClicks.has(nativeAction)) return;

        if (isKnownNonBook(nativeAction)) return;
        const itemId = resolveItemId(nativeAction);
        if (!itemId) return;

        const action = nativeAction.getAttribute('data-action')
            || (nativeAction.classList.contains('btnReplay') ? 'play' : 'resume');
        const startMode = startModeForAction(nativeAction, action);

        event.preventDefault();
        event.stopImmediatePropagation();

        const opened = await openAdvancedItem(itemId, startMode);
        if (!opened) replayClick(nativeAction);
    }

    async function handleNativeCommand(event) {
        if (!replaceNativeReader) return;
        const command = event.detail?.command;
        if (command !== 'play' && command !== 'resume' && command !== 'menu') return;

        const target = event.target instanceof Element ? event.target : null;
        if (!target || bypassCommands.has(target)) return;

        if (command === 'menu') {
            rememberContextTarget(target);
            return;
        }

        if (isKnownNonBook(target)) return;
        const itemId = resolveItemId(target);
        if (!itemId) return;

        event.preventDefault();
        event.stopImmediatePropagation();

        const opened = await openAdvancedItem(
            itemId,
            startModeForAction(target, command)
        );
        if (!opened) replayCommand(target, command);
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
            const nativeAction = host?.querySelector(
                '.btnPlay:not(.hide),.btnReplay:not(.hide),.btnPlayOrResume:not(.hide)'
            );
            button.classList.toggle('ab-native-reader-replaced', Boolean(sameItem && nativeAction));
        });
    }

    document.addEventListener('click', event => {
        handleNativeClick(event).catch(() => {});
    }, true);
    document.addEventListener('command', event => {
        handleNativeCommand(event).catch(() => {});
    }, true);
    document.addEventListener('contextmenu', event => {
        if (!replaceNativeReader) return;
        const target = event.target instanceof Element ? event.target : null;
        if (target) rememberContextTarget(target);
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
