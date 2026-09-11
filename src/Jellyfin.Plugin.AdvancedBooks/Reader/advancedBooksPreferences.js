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
                Zoom: preferences.zoom,
                SidePadding: preferences.sidePadding,
                PageGap: preferences.pageGap,
                Background: preferences.background,
                AnimateTransitions: preferences.animateTransitions,
                TouchGestures: preferences.touchGestures,
                ShowMetadata: preferences.showMetadata,
                ShowMetadataTitle: preferences.showMetadataTitle,
                ShowMetadataAuthors: preferences.showMetadataAuthors,
                ShowMetadataSeries: preferences.showMetadataSeries,
                ShowMetadataIssue: preferences.showMetadataIssue,
                ShowMetadataYear: preferences.showMetadataYear,
                AutoScrollMetadata: preferences.autoScrollMetadata
            }),
            url: getPreferencesUrl(apiClient)
        });
    }

    function normalizePreferences(raw) {
        const layout = String(raw?.Layout ?? raw?.layout ?? 'single');
        const direction = String(raw?.Direction ?? raw?.direction ?? 'rtl');
        const fit = String(raw?.Fit ?? raw?.fit ?? 'screen');
        const zoom = Number(raw?.Zoom ?? raw?.zoom ?? 1);
        const sidePadding = Number(raw?.SidePadding ?? raw?.sidePadding ?? 0);
        const pageGap = Number(raw?.PageGap ?? raw?.pageGap ?? 0);
        const background = String(raw?.Background ?? raw?.background ?? 'black');
        const animateTransitions = raw?.AnimateTransitions ?? raw?.animateTransitions ?? true;
        const touchGestures = raw?.TouchGestures ?? raw?.touchGestures ?? true;
        const boolValue = (upper, lower, fallback = true) => {
            const value = raw?.[upper] ?? raw?.[lower] ?? fallback;
            return value !== false && String(value).toLowerCase() !== 'false';
        };
        const sidePaddingValues = [0, 2, 5, 10, 15, 20];
        const pageGapValues = [0, 4, 8, 12, 16, 24, 32];
        return {
            layout: ['single', 'double', 'vertical', 'webtoon'].includes(layout) ? layout : 'single',
            direction: ['rtl', 'ltr'].includes(direction) ? direction : 'rtl',
            fit: ['screen', 'width', 'height', 'original'].includes(fit) ? fit : 'screen',
            zoom: Number.isFinite(zoom) ? Math.min(4, Math.max(.5, Math.round(zoom * 20) / 20)) : 1,
            sidePadding: sidePaddingValues.includes(sidePadding) ? sidePadding : 0,
            pageGap: pageGapValues.includes(pageGap) ? pageGap : 0,
            background: ['black', 'gray', 'white'].includes(background) ? background : 'black',
            animateTransitions: animateTransitions !== false && String(animateTransitions).toLowerCase() !== 'false',
            touchGestures: touchGestures !== false && String(touchGestures).toLowerCase() !== 'false',
            showMetadata: boolValue('ShowMetadata', 'showMetadata'),
            showMetadataTitle: boolValue('ShowMetadataTitle', 'showMetadataTitle'),
            showMetadataAuthors: boolValue('ShowMetadataAuthors', 'showMetadataAuthors'),
            showMetadataSeries: boolValue('ShowMetadataSeries', 'showMetadataSeries'),
            showMetadataIssue: boolValue('ShowMetadataIssue', 'showMetadataIssue'),
            showMetadataYear: boolValue('ShowMetadataYear', 'showMetadataYear'),
            autoScrollMetadata: boolValue('AutoScrollMetadata', 'autoScrollMetadata')
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
            sidePadding: overlay.querySelector('[data-ab-control="sidePadding"]'),
            pageGap: overlay.querySelector('[data-ab-control="pageGap"]'),
            background: overlay.querySelector('[data-ab-control="background"]'),
            transitions: overlay.querySelector('[data-ab-control="transitions"]'),
            gestures: overlay.querySelector('[data-ab-control="gestures"]'),
            showMetadata: overlay.querySelector('[data-ab-control="showMetadata"]'),
            showMetadataTitle: overlay.querySelector('[data-ab-control="showMetadataTitle"]'),
            showMetadataAuthors: overlay.querySelector('[data-ab-control="showMetadataAuthors"]'),
            showMetadataSeries: overlay.querySelector('[data-ab-control="showMetadataSeries"]'),
            showMetadataIssue: overlay.querySelector('[data-ab-control="showMetadataIssue"]'),
            showMetadataYear: overlay.querySelector('[data-ab-control="showMetadataYear"]'),
            autoScrollMetadata: overlay.querySelector('[data-ab-control="autoScrollMetadata"]'),
            zoomOut: toolbar.querySelector('button[data-ab-action="zoom-out"],button[title="Zoom out"]'),
            zoomReset: toolbar.querySelector('button[data-ab-action="zoom-reset"],button[title="Reset zoom"]'),
            zoomIn: toolbar.querySelector('button[data-ab-action="zoom-in"],button[title="Zoom in"]'),
            stage: overlay.querySelector('.advancedBooksReaderStage')
        };
    }

    function ensureHelpStyles() {
        if (document.getElementById('advancedBooksReaderHelpStyles')) return;
        const style = document.createElement('style');
        style.id = 'advancedBooksReaderHelpStyles';
        style.textContent = `
.advancedBooksReaderHelpPanel{position:absolute!important;z-index:9;top:calc(3.6rem + env(safe-area-inset-top,0px));right:.65rem;width:min(32rem,calc(100vw - 1.3rem));max-height:calc(100dvh - 5rem);overflow:auto;padding:1rem;border:1px solid rgba(255,255,255,.14);border-radius:.8rem;background:rgba(20,20,20,.97);box-shadow:0 14px 48px rgba(0,0,0,.55);box-sizing:border-box;backdrop-filter:blur(14px);color:#fff}
.advancedBooksReaderHelpPanel[hidden]{display:none!important}
.advancedBooksReaderHelpHeader{display:flex;align-items:center;justify-content:space-between;gap:.75rem;margin-bottom:.75rem;font-size:1.05rem;font-weight:600}
.advancedBooksReaderHelpGrid{display:grid;grid-template-columns:minmax(7rem,.8fr) minmax(10rem,1.4fr);gap:.45rem .9rem;font-size:.9rem;line-height:1.35}
.advancedBooksReaderHelpKey{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;opacity:.8}
.advancedBooksReaderSettingsSectionTitle{font-weight:600;padding-top:.2rem;border-top:1px solid rgba(255,255,255,.12)}
.advancedBooksReaderMetadata{overflow:hidden}
.advancedBooksReaderMetadataLine{min-width:0;overflow:hidden;white-space:nowrap}
.advancedBooksReaderMetadataText{display:inline-block;min-width:max-content;white-space:nowrap;will-change:transform}
.advancedBooksReaderMetadataLine.ab-metadata-marquee .advancedBooksReaderMetadataText{animation:advancedBooksMetadataMarquee var(--ab-metadata-duration,8s) ease-in-out 1s infinite alternate}
@keyframes advancedBooksMetadataMarquee{from{transform:translateX(0)}to{transform:translateX(var(--ab-metadata-shift,0px))}}
@media(prefers-reduced-motion:reduce){.advancedBooksReaderMetadataLine.ab-metadata-marquee .advancedBooksReaderMetadataText{animation:none!important}}
@media(max-width:700px){.advancedBooksReaderHelpPanel{position:absolute!important;top:auto;right:0;left:0;bottom:0;width:100%;max-height:min(72dvh,38rem);border-radius:1rem 1rem 0 0;padding:1rem 1rem calc(1rem + env(safe-area-inset-bottom,0px))}.advancedBooksReaderHelpGrid{grid-template-columns:1fr;gap:.18rem}.advancedBooksReaderHelpKey{margin-top:.5rem}}
`;
        document.head.appendChild(style);
    }

    function ensureMetadataControls(overlay) {
        const toolbar = overlay.querySelector('.advancedBooksReaderToolbar');
        if (!toolbar || toolbar.querySelector('[data-ab-control="showMetadata"]')) return;

        const makeSelect = (control, showLabel = 'Show', hideLabel = 'Hide') => {
            const select = document.createElement('select');
            select.dataset.abControl = control;
            for (const [value, label] of [['true', showLabel], ['false', hideLabel]]) {
                const option = document.createElement('option');
                option.value = value;
                option.textContent = label;
                select.appendChild(option);
            }
            return select;
        };
        const makeRow = (labelText, control) => {
            const row = document.createElement('div');
            row.className = 'advancedBooksReaderSettingRow';
            const label = document.createElement('label');
            label.textContent = labelText;
            control.id = `advancedBooksReader-${control.dataset.abControl}`;
            label.htmlFor = control.id;
            row.append(label, control);
            return row;
        };

        const title = document.createElement('div');
        title.className = 'advancedBooksReaderSettingsSectionTitle';
        title.textContent = 'Metadata';
        const fragment = document.createDocumentFragment();
        fragment.append(
            title,
            makeRow('Metadata header', makeSelect('showMetadata')),
            makeRow('Title', makeSelect('showMetadataTitle')),
            makeRow('Authors', makeSelect('showMetadataAuthors')),
            makeRow('Series', makeSelect('showMetadataSeries')),
            makeRow('Issue / number', makeSelect('showMetadataIssue')),
            makeRow('Year', makeSelect('showMetadataYear')),
            makeRow('Auto-scroll', makeSelect('autoScrollMetadata', 'On', 'Off'))
        );
        const hint = toolbar.querySelector('.advancedBooksReaderSettingsHint');
        toolbar.insertBefore(fragment, hint);
    }

    function refreshMetadataMarquee(session, enabled) {
        const host = session.metadataHost;
        if (!host?.isConnected) return;
        for (const line of host.querySelectorAll('.advancedBooksReaderMetadataLine')) {
            line.classList.remove('ab-metadata-marquee');
            line.style.removeProperty('--ab-metadata-shift');
            line.style.removeProperty('--ab-metadata-duration');
            if (!enabled) continue;
            const text = line.querySelector('.advancedBooksReaderMetadataText');
            const distance = Math.ceil((text?.scrollWidth ?? 0) - line.clientWidth);
            if (distance <= 4) continue;
            line.style.setProperty('--ab-metadata-shift', `-${distance}px`);
            line.style.setProperty('--ab-metadata-duration', `${Math.min(22, Math.max(7, 4 + distance / 32)).toFixed(1)}s`);
            line.classList.add('ab-metadata-marquee');
        }
    }

    function renderMetadata(session, preferences) {
        const reader = session.overlay.__advancedBooksReaderSession;
        const host = session.metadataHost;
        if (!reader || !host) return;

        const details = [];
        if (preferences.showMetadataAuthors && reader.bookAuthors?.length) {
            details.push(`Authors: ${reader.bookAuthors.join(', ')}`);
        }
        if (preferences.showMetadataSeries && reader.seriesName) {
            details.push(`Series: ${reader.seriesName}`);
        }
        if (preferences.showMetadataIssue && reader.indexNumber !== null && reader.indexNumber !== undefined) {
            details.push(`Issue: #${reader.indexNumber}`);
        }
        if (preferences.showMetadataYear && reader.productionYear !== null && reader.productionYear !== undefined) {
            details.push(`Year: ${reader.productionYear}`);
        }

        const lines = [];
        if (preferences.showMetadataTitle && reader.bookTitle) lines.push(['advancedBooksReaderTitle', reader.bookTitle]);
        if (details.length) lines.push(['advancedBooksReaderSubtitle', details.join(' · ')]);
        host.hidden = !preferences.showMetadata || lines.length === 0;
        if (host.hidden) {
            host.replaceChildren();
            return;
        }

        const nodes = lines.map(([className, value]) => {
            const line = document.createElement('div');
            line.className = `advancedBooksReaderMetadataLine ${className}`;
            line.title = value;
            const text = document.createElement('span');
            text.className = 'advancedBooksReaderMetadataText';
            text.textContent = value;
            line.appendChild(text);
            return line;
        });
        host.replaceChildren(...nodes);
        host.setAttribute('aria-label', lines.map(([, value]) => value).join('. '));
        requestAnimationFrame(() => refreshMetadataMarquee(session, preferences.autoScrollMetadata));
    }

    function attachHelp(session) {
        const top = session.overlay.querySelector('.advancedBooksReaderChromeTop');
        const settingsButton = top?.querySelector('button[data-ab-action="settings"],button[title="Reader settings"]');
        if (!top || !settingsButton) return;

        ensureHelpStyles();
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'advancedBooksReaderIconButton';
        button.textContent = '?';
        button.title = 'Reader help';
        button.setAttribute('aria-label', 'Reader help');
        button.setAttribute('aria-expanded', 'false');

        const panel = document.createElement('div');
        panel.className = 'advancedBooksReaderHelpPanel';
        panel.hidden = true;
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-label', 'Reader help');

        const header = document.createElement('div');
        header.className = 'advancedBooksReaderHelpHeader';
        const title = document.createElement('span');
        title.textContent = 'Reader controls';
        const close = document.createElement('button');
        close.type = 'button';
        close.className = 'advancedBooksReaderIconButton';
        close.textContent = '×';
        close.title = 'Close help';
        close.setAttribute('aria-label', 'Close reader help');
        header.append(title, close);

        const grid = document.createElement('div');
        grid.className = 'advancedBooksReaderHelpGrid';
        const shortcuts = [
            ['← / →', 'Previous / next page in paged modes'],
            ['Page Up / Down', 'Previous / next page or group'],
            ['Space', 'Next page or group'],
            ['Home / End', 'First / last page'],
            ['+ / − / 0', 'Zoom in / out / reset'],
            ['Ctrl + wheel', 'Zoom'],
            ['F', 'Fullscreen'],
            ['Esc', 'Close panel, then reader'],
            ['Drag', 'Pan while zoomed'],
            ['Two-finger pinch', 'Zoom when touch gestures are enabled']
        ];
        for (const [key, description] of shortcuts) {
            const keyElement = document.createElement('div');
            keyElement.className = 'advancedBooksReaderHelpKey';
            keyElement.textContent = key;
            const descriptionElement = document.createElement('div');
            descriptionElement.textContent = description;
            grid.append(keyElement, descriptionElement);
        }
        panel.append(header, grid);

        const reader = session.overlay.__advancedBooksReaderSession;
        const setOpen = open => {
            if (open && settingsButton.getAttribute('aria-expanded') === 'true') settingsButton.click();
            panel.hidden = !open;
            button.setAttribute('aria-expanded', String(open));
            if (open) {
                reader?.showControls?.(false);
                close.focus?.({ preventScroll: true });
            } else {
                reader?.showControls?.();
            }
        };
        button.addEventListener('click', () => setOpen(panel.hidden));
        close.addEventListener('click', () => {
            setOpen(false);
            button.focus?.({ preventScroll: true });
        });
        session.onSettingsClick = () => {
            if (!panel.hidden) setOpen(false);
        };
        settingsButton.addEventListener('click', session.onSettingsClick, true);

        top.insertBefore(button, settingsButton);
        session.overlay.appendChild(panel);
        session.helpButton = button;
        session.helpPanel = panel;
        session.overlay.__advancedBooksCloseHelp = () => {
            if (panel.hidden) return false;
            setOpen(false);
            button.focus?.({ preventScroll: true });
            return true;
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
            setSelect(controls.fit, preferences.fit);
            setSelect(controls.sidePadding, String(preferences.sidePadding));
            setSelect(controls.pageGap, String(preferences.pageGap));
            setSelect(controls.background, preferences.background);
            setSelect(controls.transitions, String(preferences.animateTransitions));
            setSelect(controls.gestures, String(preferences.touchGestures));
            setSelect(controls.showMetadata, String(preferences.showMetadata));
            setSelect(controls.showMetadataTitle, String(preferences.showMetadataTitle));
            setSelect(controls.showMetadataAuthors, String(preferences.showMetadataAuthors));
            setSelect(controls.showMetadataSeries, String(preferences.showMetadataSeries));
            setSelect(controls.showMetadataIssue, String(preferences.showMetadataIssue));
            setSelect(controls.showMetadataYear, String(preferences.showMetadataYear));
            setSelect(controls.autoScrollMetadata, String(preferences.autoScrollMetadata));
            applyZoom(controls, preferences.zoom, session.overlay);
            renderMetadata(session, preferences);
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
            zoom: Number.isFinite(zoomPercent) ? zoomPercent / 100 : 1,
            sidePadding: Number(controls.sidePadding?.value ?? 0),
            pageGap: Number(controls.pageGap?.value ?? 0),
            background: controls.background?.value ?? 'black',
            animateTransitions: controls.transitions?.value !== 'false',
            touchGestures: controls.gestures?.value !== 'false',
            showMetadata: controls.showMetadata?.value !== 'false',
            showMetadataTitle: controls.showMetadataTitle?.value !== 'false',
            showMetadataAuthors: controls.showMetadataAuthors?.value !== 'false',
            showMetadataSeries: controls.showMetadataSeries?.value !== 'false',
            showMetadataIssue: controls.showMetadataIssue?.value !== 'false',
            showMetadataYear: controls.showMetadataYear?.value !== 'false',
            autoScrollMetadata: controls.autoScrollMetadata?.value !== 'false'
        });
    }

    function serialize(preferences) {
        return `${preferences.layout}|${preferences.direction}|${preferences.fit}|${preferences.zoom.toFixed(2)}|${preferences.sidePadding}|${preferences.pageGap}|${preferences.background}|${preferences.animateTransitions}|${preferences.touchGestures}|${preferences.showMetadata}|${preferences.showMetadataTitle}|${preferences.showMetadataAuthors}|${preferences.showMetadataSeries}|${preferences.showMetadataIssue}|${preferences.showMetadataYear}|${preferences.autoScrollMetadata}`;
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
        session.metadataResizeObserver?.disconnect();
        session.removalObserver?.disconnect();
        session.controls.toolbar?.removeEventListener('change', session.onControlChange, true);
        if (session.overlay?.__advancedBooksCloseHelp) delete session.overlay.__advancedBooksCloseHelp;
        session.controls.toolbar?.parentElement?.querySelector('button[data-ab-action="settings"],button[title="Reader settings"]')
            ?.removeEventListener('click', session.onSettingsClick, true);
        session.helpButton?.remove();
        session.helpPanel?.remove();
        if (currentSession === session) currentSession = null;
    }

    async function attachPreferenceSession(preferencesPromise, token) {
        const overlay = await waitFor('.advancedBooksReaderOverlay', document, 4000);
        if (!overlay || token !== sessionToken) return;

        cleanupSession(currentSession, true);
        await waitForProgressReady(overlay);
        if (!overlay.isConnected || token !== sessionToken) return;

        ensureHelpStyles();
        ensureMetadataControls(overlay);
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
            metadataResizeObserver: null,
            metadataHost: overlay.querySelector('[data-ab-metadata-host="true"]'),
            removalObserver: null,
            onControlChange: null,
            onSettingsClick: null,
            helpButton: null,
            helpPanel: null
        };
        currentSession = session;

        const preferences = normalizePreferences(await preferencesPromise.catch(() => null));
        applyPreferences(session, preferences);
        session.latestPreferences = readPreferences(session);
        session.lastSaved = serialize(session.latestPreferences);
        attachHelp(session);

        session.onControlChange = () => {
            const current = readPreferences(session);
            renderMetadata(session, current);
            scheduleSave(session);
        };
        controls.toolbar.addEventListener('change', session.onControlChange, true);

        if (typeof ResizeObserver === 'function' && session.metadataHost) {
            session.metadataResizeObserver = new ResizeObserver(() => {
                refreshMetadataMarquee(session, readPreferences(session).autoScrollMetadata);
            });
            session.metadataResizeObserver.observe(session.metadataHost);
        }

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
