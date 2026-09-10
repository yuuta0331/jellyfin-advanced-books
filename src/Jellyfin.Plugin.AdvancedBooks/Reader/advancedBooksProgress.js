(function () {
    'use strict';

    if (window.__jellyfinAdvancedBooksProgressLoaded) return;
    window.__jellyfinAdvancedBooksProgressLoaded = true;

    const saveDelayMs = 1200;
    let sessionToken = 0;
    let currentSession = null;

    function getApiClient() {
        const apiClient = window.ApiClient;
        return apiClient && typeof apiClient.getUrl === 'function' ? apiClient : null;
    }

    function getProgressUrl(apiClient, itemId) {
        return apiClient.getUrl(`AdvancedBooks/Books/${encodeURIComponent(itemId)}/Progress`);
    }

    async function getProgress(itemId) {
        const apiClient = getApiClient();
        if (!apiClient || typeof apiClient.ajax !== 'function') return null;
        return apiClient.ajax({
            type: 'GET',
            dataType: 'json',
            url: getProgressUrl(apiClient, itemId)
        });
    }

    async function putProgress(itemId, pageIndex) {
        const apiClient = getApiClient();
        if (!apiClient || typeof apiClient.ajax !== 'function') return null;
        return apiClient.ajax({
            type: 'PUT',
            contentType: 'application/json',
            dataType: 'json',
            data: JSON.stringify({ PageIndex: pageIndex }),
            url: getProgressUrl(apiClient, itemId)
        });
    }

    function normalizeProgress(raw) {
        if (!raw) return null;
        return {
            pageIndex: Number(raw.PageIndex ?? raw.pageIndex ?? 0),
            pageCount: Number(raw.PageCount ?? raw.pageCount ?? 0),
            played: Boolean(raw.Played ?? raw.played ?? false)
        };
    }

    function parseCounter(counter) {
        const text = counter?.textContent?.trim() ?? '';
        const match = text.match(/^(\d+)(?:\s*[–-]\s*(\d+))?\s*\/\s*(\d+)/);
        if (!match) return null;

        const first = Number(match[1]);
        const second = match[2] ? Number(match[2]) : first;
        const pageCount = Number(match[3]);
        if (!Number.isFinite(first) || !Number.isFinite(second) || !Number.isFinite(pageCount) || pageCount <= 0) {
            return null;
        }

        return {
            pageIndex: Math.max(0, Math.min(pageCount - 1, Math.max(first, second) - 1)),
            pageCount
        };
    }

    function waitFor(selector, root = document, timeoutMs = 4000) {
        return new Promise(resolve => {
            const existing = root.querySelector(selector);
            if (existing) {
                resolve(existing);
                return;
            }

            const started = Date.now();
            const observer = new MutationObserver(() => {
                const found = root.querySelector(selector);
                if (found) {
                    observer.disconnect();
                    resolve(found);
                } else if (Date.now() - started >= timeoutMs) {
                    observer.disconnect();
                    resolve(null);
                }
            });
            observer.observe(root === document ? document.documentElement : root, { childList: true, subtree: true });
            window.setTimeout(() => {
                observer.disconnect();
                resolve(root.querySelector(selector));
            }, timeoutMs);
        });
    }

    function waitForCounterPage(counter, wantedPageIndex, timeoutMs = 2500) {
        return new Promise(resolve => {
            const isReady = () => parseCounter(counter)?.pageIndex === wantedPageIndex;
            if (isReady()) {
                resolve(true);
                return;
            }

            const observer = new MutationObserver(() => {
                if (isReady()) {
                    observer.disconnect();
                    resolve(true);
                }
            });
            observer.observe(counter, { childList: true, characterData: true, subtree: true });
            window.setTimeout(() => {
                observer.disconnect();
                resolve(isReady());
            }, timeoutMs);
        });
    }

    function markProgressReady(overlay) {
        if (!overlay?.isConnected) return;
        overlay.dataset.advancedBooksProgressReady = 'true';
        overlay.dispatchEvent(new CustomEvent('advancedbooks:progress-ready'));
    }

    async function restorePage(session, pageIndex) {
        if (pageIndex <= 0 || !session.overlay?.isConnected) return;

        const layoutSelect = session.overlay.querySelector('.advancedBooksReaderToolbar select');
        const counter = session.overlay.querySelector('.advancedBooksReaderCounter');
        if (!layoutSelect || !counter) return;

        const originalLayout = layoutSelect.value || 'single';
        session.suppressSave = true;
        session.overlay.style.visibility = 'hidden';

        try {
            if (originalLayout !== 'vertical') {
                layoutSelect.value = 'vertical';
                layoutSelect.dispatchEvent(new Event('change', { bubbles: true }));
            }

            const slot = await waitFor(`.advancedBooksReaderPageSlot[data-page-index="${pageIndex}"]`, session.overlay, 3500);
            if (!slot || !session.overlay.isConnected) return;

            const stage = session.overlay.querySelector('.advancedBooksReaderStage');
            if (stage) {
                stage.scrollTop = Math.max(0, slot.offsetTop - 4);
            } else {
                slot.scrollIntoView({ block: 'start' });
            }

            await waitForCounterPage(counter, pageIndex);

            if (originalLayout !== 'vertical' && session.overlay.isConnected) {
                layoutSelect.value = originalLayout;
                layoutSelect.dispatchEvent(new Event('change', { bubbles: true }));
            }
        } finally {
            if (session.overlay?.isConnected) session.overlay.style.visibility = '';
            session.suppressSave = false;
        }
    }

    function cleanupSession(session, flush) {
        if (!session || session.cleaned) return;
        session.cleaned = true;
        session.counterObserver?.disconnect();
        session.removalObserver?.disconnect();
        window.clearTimeout(session.saveTimer);
        if (flush) flushProgress(session);
        if (currentSession === session) currentSession = null;
    }

    function scheduleSave(session) {
        if (!session || session.cleaned || session.suppressSave) return;
        const parsed = parseCounter(session.counter);
        if (!parsed) return;
        session.lastPosition = parsed;
        window.clearTimeout(session.saveTimer);
        session.saveTimer = window.setTimeout(() => flushProgress(session), saveDelayMs);
    }

    function flushProgress(session) {
        if (!session || !session.lastPosition || session.saving) return;
        const position = session.lastPosition;
        if (session.lastSavedPage === position.pageIndex) return;

        session.saving = true;
        putProgress(session.itemId, position.pageIndex).then(() => {
            session.lastSavedPage = position.pageIndex;
        }).catch(() => {
            // Keep reading usable when progress persistence is temporarily unavailable.
        }).finally(() => {
            session.saving = false;
            if (session.lastPosition?.pageIndex !== session.lastSavedPage && !session.cleaned) {
                scheduleSave(session);
            }
        });
    }

    async function attachProgressSession(itemId, progressPromise, token) {
        const overlay = await waitFor('.advancedBooksReaderOverlay', document, 4000);
        if (!overlay || token !== sessionToken) return;

        cleanupSession(currentSession, true);
        const counter = await waitFor('.advancedBooksReaderCounter', overlay, 1500);
        if (!counter || token !== sessionToken) return;

        const session = {
            token,
            itemId,
            overlay,
            counter,
            suppressSave: true,
            saveTimer: null,
            saving: false,
            lastSavedPage: null,
            lastPosition: null,
            cleaned: false,
            counterObserver: null,
            removalObserver: null
        };
        currentSession = session;

        session.counterObserver = new MutationObserver(() => scheduleSave(session));
        session.counterObserver.observe(counter, { childList: true, characterData: true, subtree: true });

        session.removalObserver = new MutationObserver(() => {
            if (!overlay.isConnected) cleanupSession(session, true);
        });
        session.removalObserver.observe(document.body, { childList: true, subtree: true });

        const progress = normalizeProgress(await progressPromise.catch(() => null));
        if (progress && !progress.played && progress.pageCount > 0) {
            const resumePage = Math.max(0, Math.min(progress.pageCount - 1, progress.pageIndex));
            session.lastSavedPage = resumePage;
            await restorePage(session, resumePage);
        }

        session.suppressSave = false;
        scheduleSave(session);
        markProgressReady(overlay);
    }

    document.addEventListener('click', event => {
        const button = event.target?.closest?.('.advancedBooksReaderButton');
        if (!button) return;

        const itemId = button.dataset.advancedBooksItemId;
        if (!itemId) return;

        const token = ++sessionToken;
        const progressPromise = getProgress(itemId);
        attachProgressSession(itemId, progressPromise, token).catch(() => {});
    }, true);

    window.addEventListener('beforeunload', () => {
        if (currentSession) flushProgress(currentSession);
    });
})();
