(function () {
    'use strict';

    if (window.__jellyfinAdvancedBooksPreferencesLoaded) return;
    window.__jellyfinAdvancedBooksPreferencesLoaded = true;

    const saveDelayMs = 700;
    const progressReadyTimeoutMs = 5000;
    let sessionToken = 0;
    let currentSession = null;

    function getApiClient() {
        const apiClient = window.ApiClient;
        return apiClient && typeof apiClient.getUrl === 'function' ? apiClient : null;
    }

    function getPreferencesUrl(apiClient) {
        return apiClient.getUrl('AdvancedBooks/Reader/Preferences');
    }

    async function getPreferences() {
        const apiClient = getApiClient();
        if (!apiClient || typeof apiClient.ajax !== 'function') return null;
        return apiClient.ajax({
            type: 'GET',
            dataType: 'json',
            url: getPreferencesUrl(apiClient)
        });
    }

    async function putPreferences(preferences) {
        const apiClient = getApiClient();
        if (!apiClient || typeof apiClient.ajax !== 'function') return null;
        return apiClient.ajax({
            type: 'PUT',
            contentType: 'application/json',
            dataType: 'json',
            data: JSON.stringify({
                Layout: preferences.layout,
                Direction: preferences.direction,
                Fit: preferences.fit,
                Zoom: preferences.zoom
            }),
            url: getPreferencesUrl(apiClient)
        });
    }

    function normalizePreferences(raw) {
        const layout = String(raw?.Layout ?? raw?.layout ?? 'single');
        const direction = String(raw?.Direction ?? raw?.direction ?? 'rtl');
        const fit = String(raw?.Fit ?? raw?.fit ?? 'screen');
        const zoom = Number(raw?.Zoom ?? raw?.zoom ?? 1);
        return {
            layout: ['single', 'double', 'vertical', 'webtoon'].includes(layout) ? layout : 'single',
            direction: ['rtl', 'ltr'].includes(direction) ? direction : 'rtl',
            fit: ['screen', 'width', 'height', 'original'].includes(fit) ? fit : 'screen',
            zoom: Number.isFinite(zoom) ? Math.min(4, Math.max(.5, Math.round(zoom * 20) / 20)) : 1
        };
    }

    function waitFor(selector, root = document, timeoutMs = 4000) {
        return new Promise(resolve => {
            const existing = root.querySelector(selector);
            if (existing) {
                resolve(existing);
                return;
            }

            const observer = new MutationObserver(() => {
                const found = root.querySelector(selector);
                if (found) {
                    observer.disconnect();
                    resolve(found);
                }
            });
            observer.observe(root === document ? document.documentElement : root, { childList: true, subtree: true });
            window.setTimeout(() => {
                observer.disconnect();
                resolve(root.querySelector(selector));
            }, timeoutMs);
        });
    }

    function waitForProgressReady(overlay) {
        if (overlay.dataset.advancedBooksProgressReady === 'true') return Promise.resolve();

        return new Promise(resolve => {
            let settled = false;
            const finish = () => {
                if (settled) return;
                settled = true;
                overlay.removeEventListener('advancedbooks:progress-ready', onReady);
                resolve();
            };
            const onReady = () => finish();
            overlay.addEventListener('advancedbooks:progress-ready', onReady, { once: true });
            window.setTimeout(finish, progressReadyTimeoutMs);
        });
    }

    function getControls(overlay) {
        const toolbar = overlay.querySelector('.advancedBooksReaderToolbar');
        const selects = toolbar?.querySelectorAll('select') ?? [];
        if (!toolbar || selects.length < 3) return null;
        return {
            toolbar,
            layout: overlay.querySelector('[data-ab-control="layout"]') ?? selects[0],
            direction: overlay.querySelector('[data-ab-control="direction"]') ?? selects[1],
            fit: overlay.querySelector('[data-ab-control="fit"]') ?? selects[2],
            zoomOut: toolbar.querySelector('button[title="Zoom out"]'),
            zoomReset: toolbar.querySelector('button[title="Reset zoom"]'),
            zoomIn: toolbar.querySelector('button[title="Zoom in"]'),
            stage: overlay.querySelector('.advancedBooksReaderStage')
        };
    }

    function setSelect(select, value) {
        if (!select || !Array.from(select.options).some(option => option.value === value)) return;
        if (select.value === value) return;
        select.value = value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function findZoomOperations(targetZoom) {
        const start = 20;
        const target = Math.min(80, Math.max(10, Math.round(targetZoom * 20)));
        if (target === start) return [];

        const operations = [
            { delta: 5, kind: 'plus' },
            { delta: -5, kind: 'minus' },
            { delta: 3, kind: 'wheelPlus' },
            { delta: -3, kind: 'wheelMinus' }
        ];
        const queue = [{ value: start, path: [] }];
        const visited = new Set([start]);

        while (queue.length) {
            const current = queue.shift();
            for (const operation of operations) {
                const next = current.value + operation.delta;
                if (next < 10 || next > 80 || visited.has(next)) continue;
                const path = current.path.concat(operation.kind);
                if (next === target) return path;
                visited.add(next);
                queue.push({ value: next, path });
            }
        }

        return [];
    }

    function applyZoom(controls, zoom, overlay) {
        const reader = overlay?.__advancedBooksReaderSession;
        if (reader && typeof reader.setZoom === 'function') {
            reader.setZoom(zoom);
            return;
        }

        if (!controls.zoomReset) return;
        controls.zoomReset.click();
        const operations = findZoomOperations(zoom);
        for (const operation of operations) {
            if (operation === 'plus') controls.zoomIn?.click();
            else if (operation === 'minus') controls.zoomOut?.click();
            else if (controls.stage) {
                controls.stage.dispatchEvent(new WheelEvent('wheel', {
                    bubbles: true,
                    cancelable: true,
                    ctrlKey: true,
                    deltaY: operation === 'wheelPlus' ? -100 : 100
                }));
            }
        }
    }

    function applyPreferences(session, preferences) {
        const controls = session.controls;
        session.suppressSave = true;
        try {
            setSelect(controls.layout, preferences.layout);
            setSelect(controls.direction, preferences.direction);
            if (preferences.layout !== 'webtoon') setSelect(controls.fit, preferences.fit);
            applyZoom(controls, preferences.zoom, session.overlay);
        } finally {
            session.suppressSave = false;
        }
    }

    function readPreferences(session) {
        const controls = session.controls;
        const zoomText = controls.zoomReset?.textContent?.trim() ?? '100%';
        const zoomPercent = Number.parseInt(zoomText.replace('%', ''), 10);
        return normalizePreferences({
            layout: controls.layout.value,
            direction: controls.direction.value,
            fit: controls.fit.value,
            zoom: Number.isFinite(zoomPercent) ? zoomPercent / 100 : 1
        });
    }

    function serialize(preferences) {
        return `${preferences.layout}|${preferences.direction}|${preferences.fit}|${preferences.zoom.toFixed(2)}`;
    }

    function capturePreferences(session) {
        session.latestPreferences = readPreferences(session);
        return session.latestPreferences;
    }

    function scheduleSave(session) {
        if (!session || session.cleaned || session.suppressSave) return;
        capturePreferences(session);
        window.clearTimeout(session.saveTimer);
        session.saveTimer = window.setTimeout(() => flushPreferences(session, false), saveDelayMs);
    }

    function flushPreferences(session, allowAfterCleanup) {
        if (!session || (session.cleaned && !allowAfterCleanup)) return;
        const preferences = session.latestPreferences ?? capturePreferences(session);
        const serialized = serialize(preferences);
        if (serialized === session.lastSaved) return;

        if (session.saving) {
            session.queuedPreferences = preferences;
            return;
        }

        session.saving = true;
        let succeeded = false;
        putPreferences(preferences).then(() => {
            succeeded = true;
            session.lastSaved = serialized;
        }).catch(() => {
            // Reader controls remain usable when preference persistence is temporarily unavailable.
            // Do not create an automatic retry loop; the next user change can try again.
        }).finally(() => {
            session.saving = false;
            const queued = session.queuedPreferences;
            session.queuedPreferences = null;

            if (queued && serialize(queued) !== session.lastSaved) {
                session.latestPreferences = queued;
                if (session.cleaned) flushPreferences(session, true);
                else scheduleSave(session);
                return;
            }

            if (succeeded && !session.cleaned) {
                const current = capturePreferences(session);
                if (serialize(current) !== session.lastSaved) scheduleSave(session);
            }
        });
    }

    function cleanupSession(session, flush) {
        if (!session || session.cleaned) return;
        window.clearTimeout(session.saveTimer);
        if (flush) {
            capturePreferences(session);
            flushPreferences(session, true);
        }
        session.cleaned = true;
        session.zoomObserver?.disconnect();
        session.removalObserver?.disconnect();
        session.controls.toolbar?.removeEventListener('change', session.onControlChange, true);
        if (currentSession === session) currentSession = null;
    }

    async function attachPreferenceSession(preferencesPromise, token) {
        const overlay = await waitFor('.advancedBooksReaderOverlay', document, 4000);
        if (!overlay || token !== sessionToken) return;

        cleanupSession(currentSession, true);
        await waitForProgressReady(overlay);
        if (!overlay.isConnected || token !== sessionToken) return;

        const controls = getControls(overlay);
        if (!controls) return;

        const session = {
            token,
            overlay,
            controls,
            suppressSave: true,
            saveTimer: null,
            saving: false,
            lastSaved: null,
            latestPreferences: null,
            queuedPreferences: null,
            cleaned: false,
            zoomObserver: null,
            removalObserver: null,
            onControlChange: null
        };
        currentSession = session;

        const preferences = normalizePreferences(await preferencesPromise.catch(() => null));
        applyPreferences(session, preferences);
        session.latestPreferences = readPreferences(session);
        session.lastSaved = serialize(session.latestPreferences);

        session.onControlChange = () => scheduleSave(session);
        controls.toolbar.addEventListener('change', session.onControlChange, true);

        if (controls.zoomReset) {
            session.zoomObserver = new MutationObserver(() => scheduleSave(session));
            session.zoomObserver.observe(controls.zoomReset, { childList: true, characterData: true, subtree: true });
        }

        session.removalObserver = new MutationObserver(() => {
            if (!overlay.isConnected) cleanupSession(session, true);
        });
        session.removalObserver.observe(document.body, { childList: true, subtree: true });
    }

    document.addEventListener('click', event => {
        const button = event.target?.closest?.('.advancedBooksReaderButton');
        if (!button) return;
        const token = ++sessionToken;
        const preferencesPromise = getPreferences();
        attachPreferenceSession(preferencesPromise, token).catch(() => {});
    }, true);

    window.addEventListener('beforeunload', () => {
        if (!currentSession) return;
        capturePreferences(currentSession);
        flushPreferences(currentSession, true);
    });
})();
