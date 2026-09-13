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
                AutoScrollMetadata: preferences.autoScrollMetadata,
                ShowPagePosition: preferences.showPagePosition,
                Language: preferences.language
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
        const language = String(raw?.Language ?? raw?.language ?? 'auto');
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
            autoScrollMetadata: boolValue('AutoScrollMetadata', 'autoScrollMetadata'),
            showPagePosition: boolValue('ShowPagePosition', 'showPagePosition'),
            language: ['auto', 'en', 'ja', 'de', 'fr', 'es', 'zh-CN'].includes(language) ? language : 'auto'
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
            showPagePosition: overlay.querySelector('[data-ab-control="showPagePosition"]'),
            language: overlay.querySelector('[data-ab-control="language"]'),
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
.advancedBooksReaderHelpPanel{position:absolute!important;z-index:9;top:calc(3.6rem + env(safe-area-inset-top,0px));right:.65rem;width:min(34rem,calc(100vw - 1.3rem));max-height:calc(100dvh - 5rem);overflow:hidden;padding:0;display:flex;flex-direction:column;border:1px solid rgba(255,255,255,.14);border-radius:.8rem;background:rgba(20,20,20,.97);box-shadow:0 14px 48px rgba(0,0,0,.55);box-sizing:border-box;backdrop-filter:blur(14px);color:#fff}
.advancedBooksReaderHelpPanel[hidden]{display:none!important}
.advancedBooksReaderHelpHeader{display:flex;align-items:center;justify-content:space-between;gap:.75rem;flex:0 0 auto;padding:.85rem 1rem;border-bottom:1px solid rgba(255,255,255,.1);font-size:1.05rem;font-weight:700}
.advancedBooksReaderHelpBody{min-height:0;overflow:auto;overscroll-behavior:contain;padding:.8rem 1rem 1rem;scrollbar-width:thin}
.advancedBooksReaderHelpSections{display:grid;gap:.7rem}
.advancedBooksReaderHelpSection{padding:.72rem;border:1px solid rgba(255,255,255,.09);border-radius:.72rem;background:rgba(255,255,255,.035)}
.advancedBooksReaderHelpSectionTitle{margin:0 0 .5rem;font-size:.83rem;font-weight:700;opacity:.75}
.advancedBooksReaderHelpGrid{display:grid;grid-template-columns:minmax(7.5rem,.82fr) minmax(11rem,1.4fr);gap:.45rem .9rem;font-size:.9rem;line-height:1.4}
.advancedBooksReaderHelpKey{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-weight:600;opacity:.86}
.advancedBooksReaderSettingsPanel{scrollbar-width:thin;overscroll-behavior:contain;display:flex!important;flex-direction:column;gap:0!important;overflow:hidden!important;padding:0!important}
.advancedBooksReaderSettingsBody{min-height:0;overflow:auto;overscroll-behavior:contain;padding:.8rem 1rem 1rem;scrollbar-width:thin}
.advancedBooksReaderSheetHandle{display:none;flex:0 0 auto;align-items:center;justify-content:center;width:100%;min-height:1.35rem;border:0;background:transparent;color:inherit;padding:.35rem 0 .15rem;touch-action:none;cursor:ns-resize}
.advancedBooksReaderSheetHandleBar{display:block;width:2.65rem;height:.26rem;border-radius:999px;background:rgba(255,255,255,.32)}
.advancedBooksReaderSettingsPanel.ab-sheet-resizing{transition:none!important}
.advancedBooksReaderOverlay.ab-hide-page-position .advancedBooksReaderPageSliderValue{display:none!important}
.advancedBooksReaderOverlay.ab-hide-page-position.ab-controls-hidden:not(.ab-settings-open) .advancedBooksReaderChromeBottom{display:none!important}
.advancedBooksReaderChromeBottom{left:50%;right:auto;width:min(58rem,calc(100vw - 1.5rem));min-height:3.5rem;padding:.5rem .6rem calc(.5rem + env(safe-area-inset-bottom,0px));border:1px solid rgba(255,255,255,.13);border-radius:999px;background:rgba(17,17,19,.72);box-shadow:0 10px 32px rgba(0,0,0,.34);backdrop-filter:blur(14px) saturate(1.08);transform:translateX(-50%)}
.advancedBooksReaderOverlay.ab-controls-hidden:not(.ab-settings-open) .advancedBooksReaderChromeBottom{opacity:.92;pointer-events:none;width:auto;min-width:4.4rem;min-height:2rem;padding:.18rem .65rem calc(.18rem + env(safe-area-inset-bottom,0px));gap:0;transform:translateX(-50%)}
.advancedBooksReaderOverlay.ab-controls-hidden:not(.ab-settings-open) .advancedBooksReaderChromeBottom .advancedBooksReaderNavButton,.advancedBooksReaderOverlay.ab-controls-hidden:not(.ab-settings-open) .advancedBooksReaderChromeBottom .advancedBooksReaderPageSlider,.advancedBooksReaderOverlay.ab-controls-hidden:not(.ab-settings-open) .advancedBooksReaderChromeBottom .advancedBooksReaderSliderPreview{display:none!important}
.advancedBooksReaderOverlay.ab-controls-hidden:not(.ab-settings-open) .advancedBooksReaderChromeBottom .advancedBooksReaderPageSliderValue{min-width:auto;padding:0;font-size:.8rem;opacity:.86}
.advancedBooksReaderSettingsSections{display:grid;gap:.65rem}
.advancedBooksReaderSettingsSection{padding:.72rem;border:1px solid rgba(255,255,255,.1);border-radius:.72rem;background:rgba(255,255,255,.035)}
.advancedBooksReaderSettingsSection:not([open])>:not(summary){display:none!important}
.advancedBooksReaderSettingsSection[open]{display:grid;gap:.58rem}
.advancedBooksReaderSettingsSectionTitle{display:flex;align-items:center;justify-content:space-between;gap:.7rem;min-height:2rem;font-size:.86rem;font-weight:700;letter-spacing:.01em;opacity:.86;cursor:pointer;list-style:none;user-select:none}
.advancedBooksReaderSettingsSectionTitle::-webkit-details-marker{display:none}
.advancedBooksReaderSettingsSectionTitle::after{content:"⌄";font-size:1rem;line-height:1;opacity:.68;transform:rotate(0deg);transition:transform .16s ease}
.advancedBooksReaderSettingsSection[open]>.advancedBooksReaderSettingsSectionTitle::after{transform:rotate(180deg)}
.advancedBooksReaderSettingsSection .advancedBooksReaderSettingRow{padding:.08rem 0}
.advancedBooksReaderMoreButton,.advancedBooksReaderMoreMenu{display:none}
.advancedBooksReaderMoreMenu[hidden]{display:none!important}
.advancedBooksReaderMoreMenuItem{display:flex;align-items:center;gap:.7rem;width:100%;min-height:2.8rem;padding:.55rem .75rem;border:0;border-radius:.55rem;background:transparent;color:#fff;font:inherit;text-align:left;cursor:pointer}
.advancedBooksReaderMoreMenuItem:hover,.advancedBooksReaderMoreMenuItem:focus-visible{background:rgba(255,255,255,.1);outline:2px solid var(--ab-accent);outline-offset:-2px}
.advancedBooksReaderMoreMenuIcon{display:inline-flex;align-items:center;justify-content:center;width:1.4rem;font-size:1.05rem;opacity:.82}
.advancedBooksReaderSettingsHeader{position:relative;z-index:2;display:flex;align-items:center;justify-content:space-between;gap:.75rem;flex:0 0 auto;margin:0;padding:.8rem 1rem;border-bottom:1px solid rgba(255,255,255,.1);background:rgba(20,20,20,.99);backdrop-filter:blur(12px)}
.advancedBooksReaderMetadata{overflow:hidden}
.advancedBooksReaderMetadataLine{min-width:0;overflow:hidden;white-space:nowrap}
.advancedBooksReaderMetadataText{display:inline-block;min-width:max-content;white-space:nowrap;will-change:transform}
.advancedBooksReaderMetadataLine.ab-metadata-marquee{mask-image:linear-gradient(to right,transparent 0,#000 .45rem,#000 calc(100% - .45rem),transparent 100%)}
.advancedBooksReaderMetadataLine.ab-metadata-marquee .advancedBooksReaderMetadataText{animation:advancedBooksMetadataMarquee var(--ab-metadata-duration,9s) linear 1s infinite}
@keyframes advancedBooksMetadataMarquee{
    0%,16%{transform:translateX(0);opacity:1}
    72%,86%{transform:translateX(var(--ab-metadata-shift,0px));opacity:1}
    91%{transform:translateX(var(--ab-metadata-shift,0px));opacity:0}
    92%{transform:translateX(0);opacity:0}
    100%{transform:translateX(0);opacity:1}
}
@media(prefers-reduced-motion:reduce){.advancedBooksReaderMetadataLine.ab-metadata-marquee .advancedBooksReaderMetadataText{animation:none!important}.advancedBooksReaderMetadataLine.ab-metadata-marquee{mask-image:none}}
@media(max-width:700px){
    .advancedBooksReaderChrome{left:.45rem;right:.45rem;border:1px solid rgba(255,255,255,.12);background:rgba(16,16,18,.64);box-shadow:0 8px 28px rgba(0,0,0,.28);backdrop-filter:blur(14px) saturate(1.1)}
    .advancedBooksReaderChromeTop{top:calc(.4rem + env(safe-area-inset-top,0px));min-height:3.15rem;padding:.3rem .38rem;gap:.3rem;border-radius:1.55rem}
    .advancedBooksReaderMetadata{flex:1 1 0;max-width:none;min-width:0}
    .advancedBooksReaderSubtitle{font-size:.7rem}
    .advancedBooksReaderCounter{display:none}
    .advancedBooksReaderTopSpacer{display:none}
    .advancedBooksReaderChromeBottom{left:50%;right:auto;width:calc(100vw - .9rem);bottom:calc(.4rem + env(safe-area-inset-bottom,0px));min-height:3.4rem;gap:.3rem;padding:.32rem .38rem;border-radius:1.55rem}
    .advancedBooksReaderOverlay.ab-controls-hidden:not(.ab-settings-open) .advancedBooksReaderChromeBottom{left:50%;right:auto;width:auto;min-width:4.2rem;bottom:calc(.4rem + env(safe-area-inset-bottom,0px));border-radius:999px}
    .advancedBooksReaderIconButton,.advancedBooksReaderNavButton{inline-size:2.6rem;block-size:2.6rem;min-width:2.6rem;min-height:2.6rem;max-width:2.6rem;max-height:2.6rem;padding:0;flex:0 0 2.6rem}
    .advancedBooksReaderPageSlider{height:2.4rem}
    .advancedBooksReaderPageSliderValue{min-width:4.2rem;font-size:.84rem}
    .advancedBooksReaderProgressRail{height:2px}
    .advancedBooksReaderSettingsPanel{height:min(var(--ab-sheet-height,84dvh),46rem);max-height:min(92dvh,52rem);border-radius:1.25rem 1.25rem 0 0}
    .advancedBooksReaderSettingsBody{padding:.7rem 1rem calc(1rem + env(safe-area-inset-bottom,0px))}
    .advancedBooksReaderSheetHandle{display:flex}
    .advancedBooksReaderHelpPanel{position:absolute!important;top:auto;right:0;left:0;bottom:0;width:100%;height:min(84dvh,46rem);max-height:92dvh;border-radius:1.25rem 1.25rem 0 0}
    .advancedBooksReaderHelpBody{padding:.7rem 1rem calc(1rem + env(safe-area-inset-bottom,0px))}
    .advancedBooksReaderHelpGrid{grid-template-columns:minmax(7rem,.8fr) minmax(0,1.4fr);gap:.42rem .65rem}
    .advancedBooksReaderSettingsSections{gap:.55rem}
    .advancedBooksReaderSettingsSection{padding:.68rem;border-radius:.82rem}
    .advancedBooksReaderMoreButton{display:inline-flex}
    .advancedBooksReaderMoreSource{display:none!important}
    .advancedBooksReaderMoreMenu{position:absolute;z-index:11;top:calc(4rem + env(safe-area-inset-top,0px));right:.45rem;display:grid;min-width:12.5rem;padding:.38rem;border:1px solid rgba(255,255,255,.14);border-radius:.8rem;background:rgba(18,18,20,.96);box-shadow:0 14px 42px rgba(0,0,0,.5);backdrop-filter:blur(16px)}
}
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
            row.dataset.abSetting = control.dataset.abControl;
            const label = document.createElement('label');
            label.textContent = labelText;
            control.id = `advancedBooksReader-${control.dataset.abControl}`;
            label.htmlFor = control.id;
            row.append(label, control);
            return row;
        };

        const language = document.createElement('select');
        language.dataset.abControl = 'language';
        for (const [value, label] of [
            ['auto', 'Automatic (Jellyfin)'],
            ['en', 'English'],
            ['ja', '日本語'],
            ['de', 'Deutsch'],
            ['fr', 'Français'],
            ['es', 'Español'],
            ['zh-CN', '简体中文']
        ]) {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = label;
            language.appendChild(option);
        }

        const fragment = document.createDocumentFragment();
        fragment.append(
            makeRow('Reader language', language),
            makeRow('Metadata header', makeSelect('showMetadata')),
            makeRow('Title', makeSelect('showMetadataTitle')),
            makeRow('Authors', makeSelect('showMetadataAuthors')),
            makeRow('Series', makeSelect('showMetadataSeries')),
            makeRow('Issue / number', makeSelect('showMetadataIssue')),
            makeRow('Year', makeSelect('showMetadataYear')),
            makeRow('Auto-scroll', makeSelect('autoScrollMetadata', 'On', 'Off')),
            makeRow('Page position', makeSelect('showPagePosition'))
        );
        const hint = toolbar.querySelector('.advancedBooksReaderSettingsHint');
        toolbar.insertBefore(fragment, hint);
    }

    function organizeSettings(overlay) {
        const toolbar = overlay.querySelector('.advancedBooksReaderToolbar');
        if (!toolbar || toolbar.querySelector('.advancedBooksReaderSettingsSections')) return;

        const header = toolbar.querySelector('.advancedBooksReaderSettingsHeader');
        const hint = toolbar.querySelector('.advancedBooksReaderSettingsHint');
        const host = document.createElement('div');
        host.className = 'advancedBooksReaderSettingsSections';

        const sectionDefinitions = [
            ['Reading', ['layout', 'direction']],
            ['Appearance', ['fit', 'zoom', 'background', 'sidePadding', 'pageGap', 'showPagePosition']],
            ['Behavior', ['transitions', 'gestures']],
            ['Metadata', ['showMetadata', 'showMetadataTitle', 'showMetadataAuthors', 'showMetadataSeries', 'showMetadataIssue', 'showMetadataYear', 'autoScrollMetadata']],
            ['Language', ['language']]
        ];
        const compact = window.matchMedia?.('(max-width:700px)')?.matches === true;

        for (const [titleText, controls] of sectionDefinitions) {
            const section = document.createElement('details');
            section.className = 'advancedBooksReaderSettingsSection';
            section.dataset.abSettingsSection = titleText.toLowerCase();
            section.open = titleText === 'Reading' || (!compact && titleText === 'Appearance');

            const title = document.createElement('summary');
            title.className = 'advancedBooksReaderSettingsSectionTitle';
            title.textContent = titleText;
            section.appendChild(title);

            for (const control of controls) {
                const row = toolbar.querySelector(`[data-ab-setting="${control}"]`);
                if (row) section.appendChild(row);
            }

            if (titleText === 'Appearance' && hint) section.appendChild(hint);
            if (section.children.length > 1) {
                if (compact) {
                    section.addEventListener('toggle', () => {
                        if (!section.open) return;
                        for (const other of host.querySelectorAll('.advancedBooksReaderSettingsSection[open]')) {
                            if (other !== section) other.open = false;
                        }
                    });
                }
                host.appendChild(section);
            }
        }

        for (const row of Array.from(toolbar.querySelectorAll('.advancedBooksReaderSettingRow'))) {
            if (!row.closest('.advancedBooksReaderSettingsSection')) {
                host.querySelector('[data-ab-settings-section="behavior"]')?.appendChild(row);
            }
        }

        if (header) header.insertAdjacentElement('afterend', host);
        else toolbar.prepend(host);
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
            line.style.setProperty('--ab-metadata-duration', `${Math.min(24, Math.max(9, 6 + distance / 28)).toFixed(1)}s`);
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
        button.dataset.abAction = 'help';
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
            ['Left / right tap', 'Previous / next page in paged modes'],
            ['Top / bottom tap', 'Previous / next page in Vertical / Webtoon'],
            ['Mouse drag', 'Grab and pan the page / continuous canvas'],
            ['Two-finger pinch', 'Zoom when touch gestures are enabled'],
            ['Double tap', 'Zoom tapped area / restore']
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
        const focusHelpTrigger = () => {
            const trigger = session.moreButton && window.matchMedia?.('(max-width:700px)')?.matches
                ? session.moreButton
                : button;
            trigger?.focus?.({ preventScroll: true });
        };
        close.addEventListener('click', () => {
            setOpen(false);
            focusHelpTrigger();
        });
        session.onSettingsClick = () => {
            if (!panel.hidden) setOpen(false);
        };
        settingsButton.addEventListener('click', session.onSettingsClick, true);

        top.insertBefore(button, settingsButton);
        session.overlay.appendChild(panel);
        session.helpButton = button;
        session.helpPanel = panel;
        session.openHelp = () => setOpen(true);
        session.closeHelp = () => setOpen(false);
        session.overlay.__advancedBooksCloseHelp = () => {
            if (panel.hidden) return false;
            setOpen(false);
            focusHelpTrigger();
            return true;
        };
    }

    function attachMoreMenu(session) {
        const top = session.overlay.querySelector('.advancedBooksReaderChromeTop');
        const settingsButton = top?.querySelector('button[data-ab-action="settings"],button[title="Reader settings"]');
        const fullscreenButton = top?.querySelector('button[data-ab-action="fullscreen"]')
            ?? Array.from(top?.querySelectorAll('button') ?? []).find(candidate => candidate.textContent?.trim() === '⛶');
        const helpButton = session.helpButton;
        if (!top || !settingsButton || !helpButton) return;

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'advancedBooksReaderIconButton advancedBooksReaderMoreButton';
        button.dataset.abAction = 'more';
        button.textContent = '⋯';
        button.title = 'More options';
        button.setAttribute('aria-label', 'More options');
        button.setAttribute('aria-expanded', 'false');
        button.setAttribute('aria-controls', 'advancedBooksReaderMoreMenu');

        const menu = document.createElement('div');
        menu.id = 'advancedBooksReaderMoreMenu';
        menu.className = 'advancedBooksReaderMoreMenu';
        menu.hidden = true;
        menu.setAttribute('role', 'group');
        menu.setAttribute('aria-label', 'More options');

        const makeItem = (iconText, labelText, handler) => {
            const item = document.createElement('button');
            item.type = 'button';
            item.className = 'advancedBooksReaderMoreMenuItem';
            const icon = document.createElement('span');
            icon.className = 'advancedBooksReaderMoreMenuIcon';
            icon.setAttribute('aria-hidden', 'true');
            icon.textContent = iconText;
            const label = document.createElement('span');
            label.textContent = labelText;
            item.append(icon, label);
            item.addEventListener('click', handler);
            item.__advancedBooksLabel = label;
            return item;
        };

        const fullscreenItem = makeItem('⛶', 'Enter fullscreen', () => {
            setOpen(false);
            button.focus?.({ preventScroll: true });
            fullscreenButton?.click();
        });
        fullscreenItem.hidden = !fullscreenButton || fullscreenButton.hidden;

        const helpItem = makeItem('?', 'Reader help', () => {
            setOpen(false);
            button.focus?.({ preventScroll: true });
            session.openHelp?.();
        });
        menu.append(fullscreenItem, helpItem);

        if (fullscreenButton) fullscreenButton.classList.add('advancedBooksReaderMoreSource');
        helpButton.classList.add('advancedBooksReaderMoreSource');

        const reader = session.overlay.__advancedBooksReaderSession;
        const syncFullscreenLabel = () => {
            if (!fullscreenButton) return;
            fullscreenItem.hidden = fullscreenButton.hidden;
            fullscreenItem.__advancedBooksLabel.textContent = document.fullscreenElement === session.overlay
                ? 'Exit fullscreen'
                : 'Enter fullscreen';
        };

        const setOpen = open => {
            const next = Boolean(open);
            if (next) {
                if (settingsButton.getAttribute('aria-expanded') === 'true') settingsButton.click();
                session.closeHelp?.();
            }
            menu.hidden = !next;
            button.setAttribute('aria-expanded', String(next));
            if (next) {
                reader?.showControls?.(false);
                const first = Array.from(menu.querySelectorAll('button:not([hidden])'))[0];
                first?.focus?.({ preventScroll: true });
            } else if (settingsButton.getAttribute('aria-expanded') !== 'true') {
                reader?.showControls?.();
            }
        };

        button.addEventListener('click', event => {
            event.stopPropagation();
            setOpen(menu.hidden);
        });
        session.onMoreOutside = event => {
            if (menu.hidden) return;
            if (menu.contains(event.target) || button.contains(event.target)) return;
            setOpen(false);
        };
        document.addEventListener('pointerdown', session.onMoreOutside, true);

        session.onMoreSettingsClick = () => setOpen(false);
        settingsButton.addEventListener('click', session.onMoreSettingsClick, true);
        session.onFullscreenChange = syncFullscreenLabel;
        document.addEventListener('fullscreenchange', session.onFullscreenChange);
        session.onLocaleChanged = syncFullscreenLabel;
        document.addEventListener('advancedbooks:locale-changed', session.onLocaleChanged);

        const closePanel = session.overlay.__advancedBooksCloseHelp;
        session.overlay.__advancedBooksCloseHelp = () => {
            if (!menu.hidden) {
                setOpen(false);
                button.focus?.({ preventScroll: true });
                return true;
            }
            return closePanel?.() ?? false;
        };

        top.insertBefore(button, settingsButton);
        session.overlay.appendChild(menu);
        session.moreButton = button;
        session.moreMenu = menu;
        syncFullscreenLabel();
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
            setSelect(controls.language, preferences.language);
            window.AdvancedBooksI18n?.setLocale?.(preferences.language);
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
            setSelect(controls.showPagePosition, String(preferences.showPagePosition));
            session.overlay.classList.toggle('ab-hide-page-position', !preferences.showPagePosition);
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
            autoScrollMetadata: controls.autoScrollMetadata?.value !== 'false',
            showPagePosition: controls.showPagePosition?.value !== 'false',
            language: controls.language?.value ?? 'auto'
        });
    }

    function serialize(preferences) {
        return `${preferences.layout}|${preferences.direction}|${preferences.fit}|${preferences.zoom.toFixed(2)}|${preferences.sidePadding}|${preferences.pageGap}|${preferences.background}|${preferences.animateTransitions}|${preferences.touchGestures}|${preferences.showMetadata}|${preferences.showMetadataTitle}|${preferences.showMetadataAuthors}|${preferences.showMetadataSeries}|${preferences.showMetadataIssue}|${preferences.showMetadataYear}|${preferences.autoScrollMetadata}|${preferences.showPagePosition}|${preferences.language}`;
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
        const settingsButton = session.controls.toolbar?.parentElement?.querySelector('button[data-ab-action="settings"],button[title="Reader settings"]');
        settingsButton?.removeEventListener('click', session.onSettingsClick, true);
        settingsButton?.removeEventListener('click', session.onMoreSettingsClick, true);
        if (session.onMoreOutside) document.removeEventListener('pointerdown', session.onMoreOutside, true);
        if (session.onFullscreenChange) document.removeEventListener('fullscreenchange', session.onFullscreenChange);
        if (session.onLocaleChanged) document.removeEventListener('advancedbooks:locale-changed', session.onLocaleChanged);
        session.helpButton?.classList.remove('advancedBooksReaderMoreSource');
        session.moreButton?.remove();
        session.moreMenu?.remove();
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
        organizeSettings(overlay);
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
            onMoreSettingsClick: null,
            onMoreOutside: null,
            onFullscreenChange: null,
            onLocaleChanged: null,
            helpButton: null,
            helpPanel: null,
            openHelp: null,
            closeHelp: null,
            moreButton: null,
            moreMenu: null
        };
        currentSession = session;

        const preferences = normalizePreferences(await preferencesPromise.catch(() => null));
        applyPreferences(session, preferences);
        session.latestPreferences = readPreferences(session);
        session.lastSaved = serialize(session.latestPreferences);
        attachHelp(session);
        attachMoreMenu(session);

        session.onControlChange = event => {
            const current = readPreferences(session);
            if (event?.target?.dataset?.abControl === 'language') {
                window.AdvancedBooksI18n?.setLocale?.(current.language);
            }
            session.overlay.classList.toggle('ab-hide-page-position', !current.showPagePosition);
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
