(function () {
    'use strict';

    if (window.__jellyfinAdvancedBooksReaderLoaded) return;
    window.__jellyfinAdvancedBooksReaderLoaded = true;

    const metadataCache = new Map();
    const pagedCacheLimit = 8;
    const continuousCacheLimit = 12;
    const continuousKeepRadius = 5;
    const controlsRevealDistance = 40;
    const controlsEdgeRevealDistance = 12;
    const controlsVisibleActivityDistance = 14;
    const controlsEdgeSize = 72;
    const sliderThumbnailDelayMs = 80;
    const sliderThumbnailCacheLimit = 10;
    let attachSequence = 0;
    let attachTimer = null;
    let activeReader = null;

    function getApiClient() {
        const apiClient = window.ApiClient;
        return apiClient && typeof apiClient.getUrl === 'function' ? apiClient : null;
    }

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

    function normalizeMetadata(raw) {
        const pages = raw?.Pages ?? raw?.pages ?? [];
        return {
            format: raw?.Format ?? raw?.format ?? 'CBZ',
            pages: Array.isArray(pages) ? pages : []
        };
    }

    async function getMetadata(itemId) {
        const cached = metadataCache.get(itemId);
        if (cached) return cached;

        const apiClient = getApiClient();
        if (!apiClient || typeof apiClient.ajax !== 'function') {
            throw new Error('Jellyfin ApiClient is not ready.');
        }

        const request = apiClient.ajax({
            type: 'GET',
            dataType: 'json',
            url: apiClient.getUrl(`AdvancedBooks/Books/${encodeURIComponent(itemId)}/Pages`)
        }).then(normalizeMetadata);

        metadataCache.set(itemId, request);
        try {
            return await request;
        } catch (error) {
            metadataCache.delete(itemId);
            throw error;
        }
    }

    function removeReaderButtons() {
        document.querySelectorAll('.advancedBooksReaderButton').forEach(button => button.remove());
    }

    function createReaderButton(itemId, metadata) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'button-flat detailButton emby-button advancedBooksReaderButton';
        button.dataset.advancedBooksItemId = itemId;
        button.title = 'Advanced Reader';
        button.setAttribute('aria-label', 'Open Advanced Reader');

        const content = document.createElement('div');
        content.className = 'detailButton-content';
        const icon = document.createElement('span');
        icon.className = 'material-icons detailButton-icon menu_book';
        icon.setAttribute('aria-hidden', 'true');
        icon.textContent = 'menu_book';

        content.appendChild(icon);
        button.appendChild(content);

        button.addEventListener('click', () => {
            activeReader?.close();
            activeReader = new AdvancedBooksReaderSession(getApiClient(), itemId, metadata);
            activeReader.open();
        });
        return button;
    }

    async function attachReaderButton() {
        const sequence = ++attachSequence;
        const itemId = getCurrentItemId();
        if (!itemId) {
            removeReaderButtons();
            return;
        }

        if (!getApiClient()) {
            window.setTimeout(scheduleAttach, 400);
            return;
        }

        const host = Array.from(document.querySelectorAll('.mainDetailButtons'))
            .find(element => element.offsetParent !== null)
            ?? document.querySelector('.mainDetailButtons');
        if (!host) return;

        const existing = host.querySelector('.advancedBooksReaderButton');
        if (existing?.dataset.advancedBooksItemId === itemId) return;
        existing?.remove();

        try {
            const metadata = await getMetadata(itemId);
            if (sequence !== attachSequence || itemId !== getCurrentItemId() || metadata.pages.length === 0) return;

            const currentHost = Array.from(document.querySelectorAll('.mainDetailButtons'))
                .find(element => element.offsetParent !== null)
                ?? document.querySelector('.mainDetailButtons');
            if (!currentHost) return;
            currentHost.querySelector('.advancedBooksReaderButton')?.remove();
            currentHost.appendChild(createReaderButton(itemId, metadata));
        } catch {
            // Unsupported, inaccessible and safety-rejected items intentionally get no button.
        }
    }

    function scheduleAttach() {
        window.clearTimeout(attachTimer);
        attachTimer = window.setTimeout(attachReaderButton, 120);
    }

    class AdvancedBooksReaderSession {
        constructor(apiClient, itemId, metadata) {
            this.apiClient = apiClient;
            this.itemId = itemId;
            this.pages = metadata.pages;
            this.pageCount = metadata.pages.length;
            this.currentPage = 0;
            this.layout = 'single';
            this.direction = 'rtl';
            this.fit = 'screen';
            this.zoom = 1;
            this.sidePadding = 0;
            this.pageGap = 0;
            this.fullscreenOwned = false;
            this.previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
            this.panX = 0;
            this.panY = 0;
            this.renderSequence = 0;
            this.cache = new Map();
            this.pending = new Map();
            this.continuousElements = [];
            this.visibleRatios = new Map();
            this.loadObserver = null;
            this.visibilityObserver = null;
            this.previousBodyOverflow = document.body.style.overflow;
            this.pointerStart = null;
            this.lastWheelNavigation = 0;
            this.closed = false;
            this.controlsTimer = null;
            this.settingsOpen = false;
            this.suppressNextStageClick = false;
            this.lastPointerPosition = null;
            this.hiddenPointerAnchor = null;
            this.visiblePointerAnchor = null;
            this.sliderPreviewTimer = null;
            this.sliderPreviewHideTimer = null;
            this.sliderPreviewSequence = 0;
            this.sliderThumbnailCache = new Map();
            this.sliderThumbnailPending = null;
            this.boundKeyDown = event => this.onKeyDown(event);
            this.boundWheel = event => this.onWheel(event);
            this.boundPointerDown = event => this.onPointerDown(event);
            this.boundPointerMove = event => this.onPointerMove(event);
            this.boundPointerUp = event => this.onPointerUp(event);
            this.boundStageClick = event => this.onStageClick(event);
            this.boundPointerActivity = event => this.onPointerActivity(event);
            this.boundFocusIn = () => this.showControls();
            this.boundFullscreenChange = () => this.updateFullscreenButton();
        }

        async open() {
            if (!this.apiClient || this.pageCount === 0) return;
            this.closed = false;
            this.ensureStyles();
            this.buildUi();
            this.bindEvents();
            document.body.style.overflow = 'hidden';
            await this.render();
            this.showControls();
            this.stage?.focus?.({ preventScroll: true });
        }

        close() {
            if (this.closed) return;
            this.closed = true;
            window.clearTimeout(this.controlsTimer);
            window.clearTimeout(this.sliderPreviewTimer);
            window.clearTimeout(this.sliderPreviewHideTimer);
            this.hideSliderPreview(true);
            this.teardownContinuous();
            this.unbindEvents();

            for (const pending of this.pending.values()) pending.controller.abort();
            this.pending.clear();
            for (const objectUrl of this.cache.values()) URL.revokeObjectURL(objectUrl);
            this.cache.clear();
            for (const objectUrl of this.sliderThumbnailCache.values()) URL.revokeObjectURL(objectUrl);
            this.sliderThumbnailCache.clear();

            if (this.fullscreenOwned && document.fullscreenElement === this.overlay && document.exitFullscreen) {
                document.exitFullscreen().catch(() => {});
            }
            this.overlay?.remove();
            document.body.style.overflow = this.previousBodyOverflow;
            this.previousFocus?.focus?.({ preventScroll: true });
            if (activeReader === this) activeReader = null;
        }

        isContinuous() {
            return this.layout === 'vertical' || this.layout === 'webtoon';
        }

        ensureStyles() {
            if (document.getElementById('advancedBooksReaderStyles')) return;
            const style = document.createElement('style');
            style.id = 'advancedBooksReaderStyles';
            style.textContent = `
                .advancedBooksReaderButton .detailButton-content{display:flex;flex-direction:column;align-items:center;justify-content:center;min-width:0}
                .advancedBooksReaderOverlay{position:fixed;inset:0;z-index:2147483000;background:#080808;color:#fff;font-family:inherit;overflow:hidden;--ab-accent:var(--theme-primary-color,#00a4dc);--ab-progress:0%}
                .advancedBooksReaderStage{position:absolute;inset:0;overflow:auto;display:flex;align-items:center;justify-content:center;background:#080808;touch-action:pan-y;user-select:none;overscroll-behavior:contain;scrollbar-width:none}
                .advancedBooksReaderStage::-webkit-scrollbar{display:none}
                .advancedBooksReaderPages{min-width:100%;min-height:100%;display:flex;align-items:center;justify-content:center;gap:.4rem;transform-origin:center center;will-change:transform;box-sizing:border-box;padding:.4rem}
                .advancedBooksReaderPages img{display:block;object-fit:contain;flex:0 1 auto;box-shadow:0 0 20px rgba(0,0,0,.35)}
                .advancedBooksReaderPages.ab-fit-screen img{max-width:calc(100vw - 1rem);max-height:calc(100dvh - 1rem);width:auto;height:auto}
                .advancedBooksReaderPages.ab-layout-double.ab-fit-screen img{max-width:calc(50vw - .7rem)}
                .advancedBooksReaderPages.ab-fit-width{align-items:flex-start}.advancedBooksReaderPages.ab-fit-width img{width:calc(100vw - 1rem);max-width:none;height:auto}
                .advancedBooksReaderPages.ab-layout-double.ab-fit-width img{width:calc(50vw - .7rem)}
                .advancedBooksReaderPages.ab-fit-height img{height:calc(100dvh - 1rem);max-height:none;width:auto}
                .advancedBooksReaderPages.ab-fit-original img{max-width:none;max-height:none;width:auto;height:auto}
                .advancedBooksReaderStage.ab-continuous{display:block;align-items:initial;justify-content:initial;touch-action:pan-y}
                .advancedBooksReaderPages.ab-continuous{min-height:auto;min-width:0;width:100%;display:flex;flex-direction:column;justify-content:flex-start;align-items:center;transform:none;will-change:auto;padding:.5rem min(var(--ab-side-padding,0vw),12rem);gap:var(--ab-page-gap,0px);margin-inline:auto;box-sizing:border-box}
                .advancedBooksReaderPages.ab-layout-webtoon{padding-block:0}
                .advancedBooksReaderPageSlot{width:100%;min-height:55vh;display:flex;align-items:center;justify-content:center;position:relative;box-sizing:border-box}
                .advancedBooksReaderPages.ab-layout-webtoon .advancedBooksReaderPageSlot{min-height:30vh}
                .advancedBooksReaderPagePlaceholder{display:flex;align-items:center;justify-content:center;width:100%;min-height:inherit;color:rgba(255,255,255,.35);font-variant-numeric:tabular-nums}
                .advancedBooksReaderPages.ab-continuous.ab-fit-screen img{max-width:100%;max-height:100dvh;width:auto;height:auto}
                .advancedBooksReaderPages.ab-continuous.ab-fit-width img{width:100%;max-width:none;height:auto}
                .advancedBooksReaderPages.ab-continuous.ab-fit-height img{height:100dvh;max-height:none;width:auto;max-width:100%}
                .advancedBooksReaderPages.ab-continuous.ab-fit-original img{max-width:none;max-height:none;width:auto;height:auto}
                .advancedBooksReaderPages.ab-layout-webtoon img{box-shadow:none}
                .advancedBooksReaderMessage{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;font-size:1.05rem;color:rgba(255,255,255,.82);padding:1rem;text-align:center}
                .advancedBooksReaderChrome{position:absolute;left:0;right:0;z-index:6;display:flex;align-items:center;gap:.55rem;box-sizing:border-box;transition:opacity .18s ease,transform .18s ease;pointer-events:auto}
                .advancedBooksReaderChromeTop{top:0;min-height:3.5rem;padding:calc(.45rem + env(safe-area-inset-top,0px)) .75rem .45rem;background:linear-gradient(to bottom,rgba(0,0,0,.82),rgba(0,0,0,.48),transparent)}
                .advancedBooksReaderChromeBottom{bottom:0;min-height:4rem;padding:.65rem .75rem calc(.65rem + env(safe-area-inset-bottom,0px));background:linear-gradient(to top,rgba(0,0,0,.86),rgba(0,0,0,.5),transparent)}
                .advancedBooksReaderOverlay.ab-controls-hidden:not(.ab-settings-open) .advancedBooksReaderChrome{opacity:0;pointer-events:none}
                .advancedBooksReaderOverlay.ab-controls-hidden:not(.ab-settings-open) .advancedBooksReaderChromeTop{transform:translateY(-1rem)}
                .advancedBooksReaderOverlay.ab-controls-hidden:not(.ab-settings-open) .advancedBooksReaderChromeBottom{transform:translateY(1rem)}
                .advancedBooksReaderIconButton,.advancedBooksReaderNavButton{display:inline-flex;align-items:center;justify-content:center;min-width:2.75rem;min-height:2.75rem;border:1px solid rgba(255,255,255,.18);border-radius:999px;background:rgba(28,28,28,.88);color:#fff;padding:.45rem .7rem;font:inherit;cursor:pointer;backdrop-filter:blur(8px)}
                .advancedBooksReaderIconButton:hover,.advancedBooksReaderNavButton:hover,.advancedBooksReaderIconButton:focus-visible,.advancedBooksReaderNavButton:focus-visible{background:rgba(62,62,62,.95);outline:2px solid var(--ab-accent);outline-offset:2px}
                .advancedBooksReaderIconButton:disabled,.advancedBooksReaderNavButton:disabled{opacity:.35;cursor:default}
                .advancedBooksReaderTitle{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
                .advancedBooksReaderCounter{font-variant-numeric:tabular-nums;white-space:nowrap;padding:.3rem .55rem;border-radius:999px;background:rgba(0,0,0,.35)}
                .advancedBooksReaderTopSpacer{flex:1 1 auto}
                .advancedBooksReaderPagesHost{display:flex;align-items:center;gap:.4rem}
                .advancedBooksReaderPageSlider{flex:1 1 auto;min-width:5rem;height:2.75rem;margin:0;cursor:ew-resize;accent-color:var(--ab-accent);touch-action:none}
                .advancedBooksReaderPageSliderValue{min-width:5.2rem;text-align:center;font-variant-numeric:tabular-nums;white-space:nowrap}
                .advancedBooksReaderSliderPreview{position:absolute;z-index:10;bottom:calc(100% - .1rem);left:50%;transform:translate(-50%,-.35rem);width:min(10rem,30vw);padding:.4rem;border:1px solid rgba(255,255,255,.18);border-radius:.6rem;background:rgba(15,15,15,.96);box-shadow:0 10px 32px rgba(0,0,0,.55);pointer-events:none;box-sizing:border-box;backdrop-filter:blur(12px)}
                .advancedBooksReaderSliderPreview[hidden]{display:none!important}
                .advancedBooksReaderSliderPreviewImageWrap{width:100%;aspect-ratio:2/3;display:flex;align-items:center;justify-content:center;overflow:hidden;border-radius:.35rem;background:#070707}
                .advancedBooksReaderSliderPreview img{display:block;width:100%;height:100%;object-fit:contain}
                .advancedBooksReaderSliderPreviewStatus{padding:.75rem .35rem;text-align:center;font-size:.82rem;opacity:.66}
                .advancedBooksReaderSliderPreviewLabel{padding:.35rem .2rem 0;text-align:center;font-size:.85rem;font-weight:600;font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
                .advancedBooksReaderProgressRail{position:absolute;left:0;right:0;bottom:0;height:3px;z-index:5;pointer-events:none;background:rgba(255,255,255,.16)}
                .advancedBooksReaderProgressRail::after{content:"";display:block;width:var(--ab-progress);height:100%;background:var(--ab-accent);transition:width .12s linear}
                .advancedBooksReaderSettingsPanel{position:absolute!important;z-index:9;top:calc(3.6rem + env(safe-area-inset-top,0px));right:.65rem;width:min(24rem,calc(100vw - 1.3rem));max-height:calc(100dvh - 5rem);overflow:auto;display:grid!important;gap:.8rem;padding:1rem;border:1px solid rgba(255,255,255,.14);border-radius:.8rem;background:rgba(20,20,20,.97);box-shadow:0 14px 48px rgba(0,0,0,.55);box-sizing:border-box;backdrop-filter:blur(14px)}
                .advancedBooksReaderSettingsPanel[hidden]{display:none!important}
                .advancedBooksReaderSettingsHeader{display:flex;align-items:center;justify-content:space-between;gap:.75rem;font-size:1.05rem;font-weight:600}
                .advancedBooksReaderSettingRow{display:grid;grid-template-columns:minmax(7rem,1fr) minmax(9rem,1.35fr);align-items:center;gap:.75rem}
                .advancedBooksReaderSettingRow[hidden]{display:none!important}
                .advancedBooksReaderSettingRow label{opacity:.82}
                .advancedBooksReaderSettingRow select{width:100%;min-height:2.7rem;border:1px solid rgba(255,255,255,.2);border-radius:.45rem;background:#252525;color:#fff;padding:.4rem .55rem;font:inherit}
                .advancedBooksReaderZoomRow{display:flex;align-items:center;gap:.45rem;justify-content:flex-end}
                .advancedBooksReaderZoomRow button{min-width:2.7rem;min-height:2.7rem;border:1px solid rgba(255,255,255,.2);border-radius:.45rem;background:#252525;color:#fff;padding:.35rem .6rem;font:inherit}
                .advancedBooksReaderZoomRow button[title="Reset zoom"]{min-width:4.5rem;font-variant-numeric:tabular-nums}
                .advancedBooksReaderSettingsHint{margin:0;font-size:.85rem;line-height:1.35;opacity:.62}
                @media(max-width:700px){
                    .advancedBooksReaderChromeTop{min-height:3.25rem;padding-inline:.45rem;gap:.35rem}
                    .advancedBooksReaderTitle{display:none}
                    .advancedBooksReaderCounter{font-size:.9rem;padding-inline:.45rem}
                    .advancedBooksReaderChromeBottom{gap:.35rem;padding-inline:.45rem}
                    .advancedBooksReaderNavButton{min-width:2.7rem;padding-inline:.55rem}
                    .advancedBooksReaderPageSliderValue{min-width:4.4rem;font-size:.88rem}
                    .advancedBooksReaderSliderPreview{width:min(8.5rem,36vw)}
                    .advancedBooksReaderSettingsPanel{position:absolute!important;top:auto;right:0;left:0;bottom:0;width:100%;max-height:min(72dvh,38rem);border-radius:1rem 1rem 0 0;padding:1rem 1rem calc(1rem + env(safe-area-inset-bottom,0px))}
                    .advancedBooksReaderSettingRow{grid-template-columns:1fr;gap:.35rem}
                    .advancedBooksReaderPageSlot{min-height:45vh}
                }
                @media(pointer:coarse){
                    .advancedBooksReaderIconButton,.advancedBooksReaderNavButton,.advancedBooksReaderSettingRow select,.advancedBooksReaderZoomRow button{min-height:3rem}
                }
                @media(prefers-reduced-motion:reduce){
                    .advancedBooksReaderChrome,.advancedBooksReaderProgressRail::after{transition:none!important}
                }
            `;
            document.head.appendChild(style);
        }

        buildUi() {
            this.overlay = document.createElement('div');
            this.overlay.className = 'advancedBooksReaderOverlay';
            this.overlay.setAttribute('role', 'dialog');
            this.overlay.setAttribute('aria-modal', 'true');
            this.overlay.setAttribute('aria-label', 'Advanced Books Reader');
            this.overlay.__advancedBooksReaderSession = this;

            this.stage = document.createElement('div');
            this.stage.className = 'advancedBooksReaderStage';
            this.stage.tabIndex = 0;
            this.stage.setAttribute('aria-label', 'Comic page viewport');
            this.pagesElement = document.createElement('div');
            this.pagesElement.className = 'advancedBooksReaderPages';
            this.message = document.createElement('div');
            this.message.className = 'advancedBooksReaderMessage';
            this.stage.append(this.pagesElement, this.message);

            const top = document.createElement('div');
            top.className = 'advancedBooksReaderChrome advancedBooksReaderChromeTop';
            const closeButton = this.makeButton('×', () => this.close());
            closeButton.className = 'advancedBooksReaderIconButton';
            closeButton.title = 'Close (Esc)';
            closeButton.setAttribute('aria-label', 'Close reader');

            const title = document.createElement('div');
            title.className = 'advancedBooksReaderTitle';
            title.textContent = 'Advanced Reader';

            this.counter = document.createElement('div');
            this.counter.className = 'advancedBooksReaderCounter';
            this.counter.setAttribute('aria-live', 'polite');

            const topSpacer = document.createElement('div');
            topSpacer.className = 'advancedBooksReaderTopSpacer';

            this.pagesHost = document.createElement('div');
            this.pagesHost.className = 'advancedBooksReaderPagesHost';
            this.pagesHost.dataset.abPagesHost = 'true';

            this.fullscreenButton = this.makeButton('⛶', () => this.toggleFullscreen());
            this.fullscreenButton.className = 'advancedBooksReaderIconButton';
            this.fullscreenButton.title = 'Fullscreen (F)';
            this.fullscreenButton.setAttribute('aria-label', 'Enter fullscreen');
            this.fullscreenButton.hidden = typeof this.overlay.requestFullscreen !== 'function';

            this.settingsButton = this.makeButton('⚙', () => this.toggleSettings());
            this.settingsButton.className = 'advancedBooksReaderIconButton';
            this.settingsButton.title = 'Reader settings';
            this.settingsButton.setAttribute('aria-label', 'Reader settings');
            this.settingsButton.setAttribute('aria-expanded', 'false');

            top.append(closeButton, title, this.counter, topSpacer, this.fullscreenButton, this.pagesHost, this.settingsButton);

            this.toolbar = document.createElement('div');
            this.toolbar.className = 'advancedBooksReaderToolbar advancedBooksReaderSettingsPanel';
            this.toolbar.hidden = true;
            this.toolbar.setAttribute('role', 'dialog');
            this.toolbar.setAttribute('aria-label', 'Reader settings');

            const settingsHeader = document.createElement('div');
            settingsHeader.className = 'advancedBooksReaderSettingsHeader';
            const settingsTitle = document.createElement('span');
            settingsTitle.textContent = 'Reader settings';
            const settingsClose = this.makeButton('×', () => this.toggleSettings(false));
            settingsClose.className = 'advancedBooksReaderIconButton';
            settingsClose.title = 'Close settings';
            settingsClose.setAttribute('aria-label', 'Close reader settings');
            settingsHeader.append(settingsTitle, settingsClose);

            this.layoutSelect = this.makeSelect([
                ['single', 'Single page'],
                ['double', 'Double page'],
                ['vertical', 'Vertical continuous'],
                ['webtoon', 'Webtoon']
            ], this.layout, value => this.setLayout(value));
            this.layoutSelect.dataset.abControl = 'layout';
            this.layoutSelect.setAttribute('aria-label', 'Reader layout');

            this.directionSelect = this.makeSelect([
                ['rtl', 'Right to left'],
                ['ltr', 'Left to right']
            ], this.direction, value => {
                this.direction = value;
                this.resetPan();
                this.render();
            });
            this.directionSelect.dataset.abControl = 'direction';
            this.directionSelect.setAttribute('aria-label', 'Paged reading direction');

            this.fitSelect = this.makeSelect([
                ['screen', 'Fit screen'],
                ['width', 'Fit width'],
                ['height', 'Fit height'],
                ['original', 'Original size']
            ], this.fit, value => {
                this.fit = value;
                this.resetPan();
                this.render();
            });
            this.fitSelect.dataset.abControl = 'fit';
            this.fitSelect.setAttribute('aria-label', 'Image fit');

            this.sidePaddingSelect = this.makeSelect([
                ['0', 'None'],
                ['2', '2%'],
                ['5', '5%'],
                ['10', '10%'],
                ['15', '15%'],
                ['20', '20%']
            ], String(this.sidePadding), value => {
                this.sidePadding = Number(value) || 0;
                this.applyTransform();
            });
            this.sidePaddingSelect.dataset.abControl = 'sidePadding';
            this.sidePaddingSelect.setAttribute('aria-label', 'Continuous side padding');

            this.pageGapSelect = this.makeSelect([
                ['0', 'None'],
                ['4', '4 px'],
                ['8', '8 px'],
                ['12', '12 px'],
                ['16', '16 px'],
                ['24', '24 px'],
                ['32', '32 px']
            ], String(this.pageGap), value => {
                this.pageGap = Number(value) || 0;
                this.applyTransform();
            });
            this.pageGapSelect.dataset.abControl = 'pageGap';
            this.pageGapSelect.setAttribute('aria-label', 'Continuous page gap');

            this.zoomOutButton = this.makeButton('−', () => this.setZoom(this.zoom - .25));
            this.zoomOutButton.title = 'Zoom out';
            this.zoomResetButton = this.makeButton('100%', () => this.setZoom(1));
            this.zoomResetButton.title = 'Reset zoom';
            this.zoomInButton = this.makeButton('+', () => this.setZoom(this.zoom + .25));
            this.zoomInButton.title = 'Zoom in';

            const zoomRow = document.createElement('div');
            zoomRow.className = 'advancedBooksReaderZoomRow';
            zoomRow.append(this.zoomOutButton, this.zoomResetButton, this.zoomInButton);

            let controlSequence = 0;
            const row = (labelText, control) => {
                const wrapper = document.createElement('div');
                wrapper.className = 'advancedBooksReaderSettingRow';
                const label = document.createElement('label');
                label.textContent = labelText;
                if (control instanceof HTMLElement && control.tagName !== 'DIV') {
                    if (!control.id) control.id = `advancedBooksReaderControl-${++controlSequence}`;
                    label.htmlFor = control.id;
                }
                wrapper.append(label, control);
                return wrapper;
            };

            this.directionRow = row('Reading direction', this.directionSelect);
            this.sidePaddingRow = row('Side padding', this.sidePaddingSelect);
            this.pageGapRow = row('Page gap', this.pageGapSelect);

            const hint = document.createElement('p');
            hint.className = 'advancedBooksReaderSettingsHint';
            hint.textContent = 'Vertical and Webtoon keep native one-finger scrolling. Use Side padding and Page gap to tune continuous layouts; reader zoom remains available in every mode.';

            this.toolbar.append(
                settingsHeader,
                row('Layout', this.layoutSelect),
                this.directionRow,
                row('Fit', this.fitSelect),
                row('Zoom', zoomRow),
                this.sidePaddingRow,
                this.pageGapRow,
                hint
            );

            const bottom = document.createElement('div');
            bottom.className = 'advancedBooksReaderChrome advancedBooksReaderChromeBottom';
            this.previousButton = this.makeButton('‹', () => this.previous());
            this.previousButton.className = 'advancedBooksReaderNavButton';
            this.previousButton.title = 'Previous page';
            this.previousButton.setAttribute('aria-label', 'Previous page');

            this.pageSlider = document.createElement('input');
            this.pageSlider.type = 'range';
            this.pageSlider.className = 'advancedBooksReaderPageSlider';
            this.pageSlider.min = '1';
            this.pageSlider.max = String(Math.max(1, this.pageCount));
            this.pageSlider.step = '1';
            this.pageSlider.value = '1';
            this.pageSlider.setAttribute('aria-label', 'Jump to page');
            this.pageSlider.addEventListener('pointerdown', () => {
                this.showControls(false);
                this.previewSlider(true);
            });
            this.pageSlider.addEventListener('input', () => {
                this.previewSlider(true);
                this.showControls(false);
            });
            const finishSliderInteraction = () => {
                this.showControls();
                this.scheduleSliderPreviewHide();
            };
            this.pageSlider.addEventListener('pointerup', finishSliderInteraction);
            this.pageSlider.addEventListener('pointercancel', () => {
                this.showControls();
                this.hideSliderPreview(true);
            });
            this.pageSlider.addEventListener('blur', () => this.scheduleSliderPreviewHide(250));
            this.pageSlider.addEventListener('change', () => {
                const index = Number(this.pageSlider.value) - 1;
                if (Number.isFinite(index)) this.goTo(index, 'auto');
                this.showControls();
                this.scheduleSliderPreviewHide();
            });

            this.pageSliderValue = document.createElement('div');
            this.pageSliderValue.className = 'advancedBooksReaderPageSliderValue';

            this.nextButton = this.makeButton('›', () => this.next());
            this.nextButton.className = 'advancedBooksReaderNavButton';
            this.nextButton.title = 'Next page';
            this.nextButton.setAttribute('aria-label', 'Next page');

            this.sliderPreview = document.createElement('div');
            this.sliderPreview.className = 'advancedBooksReaderSliderPreview';
            this.sliderPreview.hidden = true;
            this.sliderPreview.setAttribute('aria-hidden', 'true');

            const sliderPreviewImageWrap = document.createElement('div');
            sliderPreviewImageWrap.className = 'advancedBooksReaderSliderPreviewImageWrap';
            this.sliderPreviewImage = document.createElement('img');
            this.sliderPreviewImage.alt = '';
            this.sliderPreviewImage.hidden = true;
            this.sliderPreviewStatus = document.createElement('div');
            this.sliderPreviewStatus.className = 'advancedBooksReaderSliderPreviewStatus';
            this.sliderPreviewStatus.textContent = 'Loading preview…';
            sliderPreviewImageWrap.append(this.sliderPreviewImage, this.sliderPreviewStatus);

            this.sliderPreviewLabel = document.createElement('div');
            this.sliderPreviewLabel.className = 'advancedBooksReaderSliderPreviewLabel';
            this.sliderPreview.append(sliderPreviewImageWrap, this.sliderPreviewLabel);

            this.bottomChrome = bottom;
            bottom.append(this.previousButton, this.pageSlider, this.pageSliderValue, this.nextButton, this.sliderPreview);

            const rail = document.createElement('div');
            rail.className = 'advancedBooksReaderProgressRail';

            this.overlay.append(this.stage, top, bottom, rail, this.toolbar);
            document.body.appendChild(this.overlay);
            this.syncControlState();
        }

        showControls(autoHide = true) {
            if (!this.overlay?.isConnected) return;
            this.overlay.classList.remove('ab-controls-hidden');
            this.hiddenPointerAnchor = null;
            if (this.lastPointerPosition) this.visiblePointerAnchor = { ...this.lastPointerPosition };
            window.clearTimeout(this.controlsTimer);
            if (autoHide && !this.settingsOpen) {
                this.controlsTimer = window.setTimeout(() => this.hideControls(), 2800);
            }
        }

        hideControls() {
            if (!this.overlay?.isConnected || this.settingsOpen) return;
            this.overlay.classList.add('ab-controls-hidden');
            this.hiddenPointerAnchor = this.lastPointerPosition ? { ...this.lastPointerPosition } : null;
            this.visiblePointerAnchor = null;
        }

        toggleControls() {
            if (this.settingsOpen) {
                this.toggleSettings(false);
                return;
            }
            if (this.overlay.classList.contains('ab-controls-hidden')) this.showControls();
            else {
                window.clearTimeout(this.controlsTimer);
                this.hideControls();
            }
        }

        toggleSettings(force) {
            const next = typeof force === 'boolean' ? force : !this.settingsOpen;
            this.settingsOpen = next;
            this.toolbar.hidden = !next;
            this.settingsButton?.setAttribute('aria-expanded', String(next));
            this.overlay?.classList.toggle('ab-settings-open', next);
            if (next) {
                this.showControls(false);
                this.layoutSelect?.focus?.({ preventScroll: true });
            } else {
                this.showControls();
                this.settingsButton?.focus?.({ preventScroll: true });
            }
        }

        async toggleFullscreen() {
            if (!this.overlay?.isConnected || typeof this.overlay.requestFullscreen !== 'function') return;
            try {
                if (document.fullscreenElement === this.overlay) {
                    this.fullscreenOwned = false;
                    await document.exitFullscreen?.();
                } else {
                    await this.overlay.requestFullscreen({ navigationUI: 'hide' });
                    this.fullscreenOwned = document.fullscreenElement === this.overlay;
                }
            } catch {
                // Fullscreen can be denied by wrapper clients or browser policy.
            }
            this.updateFullscreenButton();
            this.showControls();
        }

        updateFullscreenButton() {
            if (!this.fullscreenButton) return;
            const active = document.fullscreenElement === this.overlay;
            this.fullscreenButton.textContent = active ? '⛶' : '⛶';
            this.fullscreenButton.title = active ? 'Exit fullscreen (F)' : 'Fullscreen (F)';
            this.fullscreenButton.setAttribute('aria-label', active ? 'Exit fullscreen' : 'Enter fullscreen');
            if (!active) this.fullscreenOwned = false;
        }

        previewSlider(showThumbnail = false) {
            if (!this.pageSlider || !this.pageSliderValue) return;
            const page = Math.max(1, Math.min(this.pageCount, Number(this.pageSlider.value) || 1));
            this.pageSliderValue.textContent = `${page} / ${this.pageCount}`;
            if (showThumbnail) this.showSliderPreview(page - 1);
        }

        showSliderPreview(index) {
            if (!this.sliderPreview || !this.pageSlider) return;
            const clamped = Math.max(0, Math.min(this.pageCount - 1, index));
            const last = this.layout === 'double'
                ? Math.min(this.pageCount - 1, clamped + 1)
                : clamped;
            this.sliderPreviewLabel.textContent = last > clamped
                ? `Pages ${clamped + 1}–${last + 1}`
                : `Page ${clamped + 1}`;
            this.sliderPreview.hidden = false;
            window.clearTimeout(this.sliderPreviewHideTimer);
            this.positionSliderPreview(clamped);
            this.scheduleSliderThumbnail(clamped);
        }

        positionSliderPreview(index) {
            if (!this.sliderPreview || !this.bottomChrome || !this.pageSlider) return;
            const sliderRect = this.pageSlider.getBoundingClientRect();
            const chromeRect = this.bottomChrome.getBoundingClientRect();
            if (sliderRect.width <= 0 || chromeRect.width <= 0) return;

            const denominator = Math.max(1, this.pageCount - 1);
            let ratio = Math.max(0, Math.min(1, index / denominator));
            if (this.pageSlider.dir === 'rtl') ratio = 1 - ratio;

            const rawLeft = sliderRect.left - chromeRect.left + (sliderRect.width * ratio);
            const halfWidth = Math.max(52, this.sliderPreview.offsetWidth / 2);
            const left = Math.max(halfWidth + 8, Math.min(chromeRect.width - halfWidth - 8, rawLeft));
            this.sliderPreview.style.left = `${left}px`;
        }

        scheduleSliderThumbnail(index) {
            window.clearTimeout(this.sliderPreviewTimer);
            const sequence = ++this.sliderPreviewSequence;

            this.sliderThumbnailPending?.controller.abort();
            this.sliderThumbnailPending = null;

            const cached = this.sliderThumbnailCache.get(index);
            if (cached) {
                this.applySliderThumbnail(index, cached, sequence);
                return;
            }

            this.sliderPreviewImage.hidden = true;
            this.sliderPreviewStatus.hidden = false;
            this.sliderPreviewStatus.textContent = 'Loading preview…';
            this.sliderPreviewTimer = window.setTimeout(
                () => this.loadSliderThumbnail(index, sequence),
                sliderThumbnailDelayMs
            );
        }

        async loadSliderThumbnail(index, sequence) {
            if (this.closed || this.sliderPreview?.hidden || sequence !== this.sliderPreviewSequence) return;
            const controller = new AbortController();
            const url = this.apiClient.getUrl(
                `AdvancedBooks/Books/${encodeURIComponent(this.itemId)}/Pages/${index}/Thumbnail?width=240`
            );
            const pending = { index, controller };
            this.sliderThumbnailPending = pending;
            try {
                const response = await this.apiClient.fetch({ url, method: 'GET', signal: controller.signal }, true);
                if (!response || response.ok === false) throw new Error(`HTTP ${response?.status ?? 'error'}`);
                const blob = await response.blob();
                if (this.closed || sequence !== this.sliderPreviewSequence || this.sliderPreview?.hidden) return;
                const objectUrl = URL.createObjectURL(blob);
                const existing = this.sliderThumbnailCache.get(index);
                if (existing) URL.revokeObjectURL(existing);
                this.sliderThumbnailCache.delete(index);
                this.sliderThumbnailCache.set(index, objectUrl);
                this.trimSliderThumbnailCache(index);
                this.applySliderThumbnail(index, objectUrl, sequence);
            } catch (error) {
                if (error?.name === 'AbortError') return;
                if (sequence === this.sliderPreviewSequence && !this.sliderPreview?.hidden) {
                    this.sliderPreviewImage.hidden = true;
                    this.sliderPreviewStatus.hidden = false;
                    this.sliderPreviewStatus.textContent = 'Preview unavailable';
                }
            } finally {
                if (this.sliderThumbnailPending === pending) this.sliderThumbnailPending = null;
            }
        }

        applySliderThumbnail(index, objectUrl, sequence) {
            if (sequence !== this.sliderPreviewSequence || this.sliderPreview?.hidden) return;
            this.sliderPreviewImage.src = objectUrl;
            this.sliderPreviewImage.alt = `Preview of page ${index + 1}`;
            this.sliderPreviewImage.hidden = false;
            this.sliderPreviewStatus.hidden = true;
        }

        trimSliderThumbnailCache(protectedIndex) {
            while (this.sliderThumbnailCache.size > sliderThumbnailCacheLimit) {
                const candidate = this.sliderThumbnailCache.keys().next().value;
                if (candidate === undefined) break;
                if (candidate === protectedIndex && this.sliderThumbnailCache.size > 1) {
                    const objectUrl = this.sliderThumbnailCache.get(candidate);
                    this.sliderThumbnailCache.delete(candidate);
                    this.sliderThumbnailCache.set(candidate, objectUrl);
                    continue;
                }
                const objectUrl = this.sliderThumbnailCache.get(candidate);
                this.sliderThumbnailCache.delete(candidate);
                URL.revokeObjectURL(objectUrl);
            }
        }

        scheduleSliderPreviewHide(delay = 650) {
            window.clearTimeout(this.sliderPreviewHideTimer);
            this.sliderPreviewHideTimer = window.setTimeout(() => this.hideSliderPreview(true), delay);
        }

        hideSliderPreview(abortPending = false) {
            window.clearTimeout(this.sliderPreviewTimer);
            window.clearTimeout(this.sliderPreviewHideTimer);
            ++this.sliderPreviewSequence;
            if (abortPending) {
                this.sliderThumbnailPending?.controller.abort();
                this.sliderThumbnailPending = null;
            }
            if (this.sliderPreview) this.sliderPreview.hidden = true;
        }

        makeButton(label, onClick) {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = label;
            button.addEventListener('click', onClick);
            return button;
        }

        makeSelect(options, value, onChange) {
            const select = document.createElement('select');
            for (const [optionValue, optionLabel] of options) {
                const option = document.createElement('option');
                option.value = optionValue;
                option.textContent = optionLabel;
                select.appendChild(option);
            }
            select.value = value;
            select.addEventListener('change', () => onChange(select.value));
            return select;
        }

        setLayout(value) {
            this.layout = value;
            if (value === 'double') this.currentPage = Math.floor(this.currentPage / 2) * 2;
            this.resetPan();
            this.syncControlState();
            this.render();
        }

        syncControlState() {
            const continuous = this.isContinuous();
            this.directionSelect.disabled = false;
            this.fitSelect.disabled = false;
            this.zoomOutButton.disabled = this.zoom <= .5;
            this.zoomInButton.disabled = this.zoom >= 4;
            if (this.directionRow) this.directionRow.hidden = continuous;
            if (this.sidePaddingRow) this.sidePaddingRow.hidden = !continuous;
            if (this.pageGapRow) this.pageGapRow.hidden = !continuous;
            this.updateFullscreenButton();
        }

        bindEvents() {
            document.addEventListener('keydown', this.boundKeyDown, true);
            this.stage.addEventListener('wheel', this.boundWheel, { passive: false });
            this.stage.addEventListener('pointerdown', this.boundPointerDown);
            this.stage.addEventListener('pointermove', this.boundPointerMove);
            this.stage.addEventListener('pointerup', this.boundPointerUp);
            this.stage.addEventListener('pointercancel', this.boundPointerUp);
            this.stage.addEventListener('click', this.boundStageClick);
            this.overlay.addEventListener('pointermove', this.boundPointerActivity, { passive: true });
            this.overlay.addEventListener('focusin', this.boundFocusIn);
            document.addEventListener('fullscreenchange', this.boundFullscreenChange);
        }

        unbindEvents() {
            document.removeEventListener('keydown', this.boundKeyDown, true);
            this.stage?.removeEventListener('wheel', this.boundWheel);
            this.stage?.removeEventListener('pointerdown', this.boundPointerDown);
            this.stage?.removeEventListener('pointermove', this.boundPointerMove);
            this.stage?.removeEventListener('pointerup', this.boundPointerUp);
            this.stage?.removeEventListener('pointercancel', this.boundPointerUp);
            this.stage?.removeEventListener('click', this.boundStageClick);
            this.overlay?.removeEventListener('pointermove', this.boundPointerActivity);
            this.overlay?.removeEventListener('focusin', this.boundFocusIn);
            document.removeEventListener('fullscreenchange', this.boundFullscreenChange);
        }

        onPointerActivity(event) {
            if (event.pointerType === 'touch' || !this.overlay?.isConnected) return;

            const point = { x: event.clientX, y: event.clientY };
            const previous = this.lastPointerPosition;
            this.lastPointerPosition = point;

            if (this.pointerStart || this.settingsOpen) return;

            const hidden = this.overlay.classList.contains('ab-controls-hidden');
            if (hidden) {
                if (!this.hiddenPointerAnchor) {
                    this.hiddenPointerAnchor = previous ? { ...previous } : point;
                    return;
                }

                const distance = Math.hypot(
                    point.x - this.hiddenPointerAnchor.x,
                    point.y - this.hiddenPointerAnchor.y
                );
                const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
                const nearChromeEdge = point.y <= controlsEdgeSize
                    || point.y >= viewportHeight - controlsEdgeSize;
                const threshold = nearChromeEdge ? controlsEdgeRevealDistance : controlsRevealDistance;

                if (distance >= threshold) {
                    this.hiddenPointerAnchor = point;
                    this.visiblePointerAnchor = point;
                    this.showControls();
                }
                return;
            }

            if (event.target?.closest?.('.advancedBooksReaderChrome,.advancedBooksReaderSettingsPanel,.advancedBooksNavigatorPanel')) {
                this.visiblePointerAnchor = point;
                this.showControls();
                return;
            }

            if (!this.visiblePointerAnchor) {
                this.visiblePointerAnchor = previous ? { ...previous } : point;
                return;
            }

            const distance = Math.hypot(
                point.x - this.visiblePointerAnchor.x,
                point.y - this.visiblePointerAnchor.y
            );
            if (distance >= controlsVisibleActivityDistance) {
                this.visiblePointerAnchor = point;
                this.showControls();
            }
        }

        onStageClick(event) {
            if (!this.isContinuous()) return;
            if (this.suppressNextStageClick) {
                this.suppressNextStageClick = false;
                return;
            }
            if (event.target?.closest?.('button,select,input,.advancedBooksReaderSettingsPanel,.advancedBooksNavigatorPanel')) return;
            this.toggleControls();
        }

        pageStep() {
            return this.layout === 'double' ? 2 : 1;
        }

        alignPage(index) {
            return this.layout === 'double' ? Math.floor(index / 2) * 2 : index;
        }

        previous() { this.goTo(this.currentPage - this.pageStep()); }
        next() { this.goTo(this.currentPage + this.pageStep()); }

        goTo(index, behavior = 'smooth') {
            const maximum = Math.max(0, this.pageCount - 1);
            const clamped = Math.min(maximum, Math.max(0, index));
            const aligned = this.alignPage(clamped);
            if (this.isContinuous()) {
                this.currentPage = clamped;
                this.updateControls();
                const element = this.continuousElements[clamped];
                if (element) {
                    this.loadContinuousPage(clamped, element).catch(() => {});
                    this.stage.scrollTo({ top: Math.max(0, element.offsetTop - 4), behavior });
                }
                return;
            }
            if (aligned === this.currentPage) return;
            this.currentPage = aligned;
            this.resetPan();
            this.render();
        }

        visibleIndexes() {
            const indexes = [this.currentPage];
            if (this.layout === 'double' && this.currentPage + 1 < this.pageCount) indexes.push(this.currentPage + 1);
            if (this.direction === 'rtl' && indexes.length > 1) indexes.reverse();
            return indexes;
        }

        async render() {
            const sequence = ++this.renderSequence;
            this.syncControlState();
            if (this.isContinuous()) {
                await this.renderContinuous(sequence);
            } else {
                this.teardownContinuous();
                await this.renderPaged(sequence);
            }
        }

        async renderPaged(sequence) {
            this.stage.className = 'advancedBooksReaderStage';
            this.message.textContent = 'Loading page…';
            this.updateControls();
            try {
                const indexes = this.visibleIndexes();
                const urls = await Promise.all(indexes.map(index => this.loadPage(index)));
                if (sequence !== this.renderSequence || this.closed || !this.overlay?.isConnected) return;

                this.pagesElement.replaceChildren();
                indexes.forEach((index, position) => {
                    const image = document.createElement('img');
                    image.src = urls[position];
                    image.alt = `Page ${index + 1}`;
                    image.draggable = false;
                    this.pagesElement.appendChild(image);
                });
                this.message.textContent = '';
                this.applyTransform();
                this.prefetchPaged();
                this.trimCache();
            } catch (error) {
                if (sequence === this.renderSequence && !this.closed) {
                    this.message.textContent = `Unable to load page: ${error?.message ?? 'Unknown error'}`;
                }
            }
        }

        async renderContinuous(sequence) {
            this.teardownContinuous();
            this.resetPan();
            this.stage.className = 'advancedBooksReaderStage ab-continuous';
            this.pagesElement.className = `advancedBooksReaderPages ab-continuous ab-layout-${this.layout} ab-fit-${this.fit}`;
            this.pagesElement.style.transform = 'none';
            this.pagesElement.replaceChildren();
            this.message.textContent = '';
            this.applyTransform();
            this.continuousElements = new Array(this.pageCount);
            this.visibleRatios.clear();

            const fragment = document.createDocumentFragment();
            for (let index = 0; index < this.pageCount; index++) {
                const slot = document.createElement('section');
                slot.className = 'advancedBooksReaderPageSlot';
                slot.dataset.pageIndex = String(index);
                slot.setAttribute('aria-label', `Page ${index + 1}`);
                this.ensurePlaceholder(slot, index);
                this.continuousElements[index] = slot;
                fragment.appendChild(slot);
            }
            this.pagesElement.appendChild(fragment);
            if (sequence !== this.renderSequence || this.closed) return;

            this.loadObserver = new IntersectionObserver(entries => {
                for (const entry of entries) {
                    if (!entry.isIntersecting) continue;
                    const index = Number(entry.target.dataset.pageIndex);
                    this.loadContinuousPage(index, entry.target).catch(() => {
                        if (entry.target.isConnected) this.ensurePlaceholder(entry.target, index, 'Failed to load');
                    });
                }
            }, { root: this.stage, rootMargin: '140% 0px', threshold: 0.01 });

            this.visibilityObserver = new IntersectionObserver(entries => {
                for (const entry of entries) {
                    const index = Number(entry.target.dataset.pageIndex);
                    if (entry.isIntersecting) this.visibleRatios.set(index, entry.intersectionRatio);
                    else this.visibleRatios.delete(index);
                }
                this.updateContinuousCurrentPage();
            }, { root: this.stage, threshold: [0.05, 0.2, 0.4, 0.6, 0.8] });

            for (const slot of this.continuousElements) {
                this.loadObserver.observe(slot);
                this.visibilityObserver.observe(slot);
            }

            this.updateControls();
            const target = this.continuousElements[this.currentPage];
            if (target) {
                await this.loadContinuousPage(this.currentPage, target).catch(() => {});
                requestAnimationFrame(() => {
                    if (!this.closed && this.isContinuous()) this.stage.scrollTop = Math.max(0, target.offsetTop - 4);
                });
            }
        }

        teardownContinuous() {
            this.loadObserver?.disconnect();
            this.visibilityObserver?.disconnect();
            this.loadObserver = null;
            this.visibilityObserver = null;
            this.visibleRatios.clear();
            this.continuousElements = [];
        }

        updateContinuousCurrentPage() {
            if (!this.isContinuous() || this.visibleRatios.size === 0) return;
            let bestIndex = this.currentPage;
            let bestRatio = -1;
            for (const [index, ratio] of this.visibleRatios) {
                if (ratio > bestRatio || (ratio === bestRatio && Math.abs(index - this.currentPage) < Math.abs(bestIndex - this.currentPage))) {
                    bestIndex = index;
                    bestRatio = ratio;
                }
            }
            if (bestIndex !== this.currentPage) {
                this.currentPage = bestIndex;
                this.updateControls();
                this.trimCache();
                this.trimPendingContinuous();
            }
        }

        ensurePlaceholder(slot, index, message) {
            slot.querySelector('img')?.remove();
            let placeholder = slot.querySelector('.advancedBooksReaderPagePlaceholder');
            if (!placeholder) {
                placeholder = document.createElement('div');
                placeholder.className = 'advancedBooksReaderPagePlaceholder';
                slot.appendChild(placeholder);
            }
            placeholder.textContent = message ? `${message} — page ${index + 1}` : `Page ${index + 1}`;
        }

        async loadContinuousPage(index, slot) {
            if (!slot?.isConnected || this.closed || !this.isContinuous()) return;
            const url = await this.loadPage(index);
            if (!slot.isConnected || this.closed || !this.isContinuous() || this.continuousElements[index] !== slot) return;
            let image = slot.querySelector('img');
            if (!image) {
                image = document.createElement('img');
                image.alt = `Page ${index + 1}`;
                image.draggable = false;
                image.dataset.pageIndex = String(index);
                slot.querySelector('.advancedBooksReaderPagePlaceholder')?.remove();
                slot.appendChild(image);
            }
            if (image.src !== url) image.src = url;
            const applySize = () => this.applyContinuousImageSizing(image);
            image.addEventListener('load', applySize, { once: true });
            if (image.complete) applySize();
        }

        applyContinuousImageSizing(image) {
            if (!image || !this.isContinuous()) return;
            image.style.width = '';
            image.style.height = '';
            image.style.maxWidth = '';
            image.style.maxHeight = '';

            if (this.fit === 'height') {
                const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
                image.style.height = `${Math.max(1, Math.round(viewportHeight * this.zoom))}px`;
                image.style.width = 'auto';
                image.style.maxWidth = 'none';
                return;
            }

            if (this.fit === 'original' && image.naturalWidth > 0) {
                image.style.width = `${Math.max(1, Math.round(image.naturalWidth * this.zoom))}px`;
                image.style.height = 'auto';
                image.style.maxWidth = 'none';
                image.style.maxHeight = 'none';
            }
        }

        refreshContinuousImageSizing() {
            if (!this.isContinuous()) return;
            for (const image of this.pagesElement.querySelectorAll('img')) {
                this.applyContinuousImageSizing(image);
            }
        }

        async loadPage(index) {
            if (this.cache.has(index)) return this.cache.get(index);
            const pending = this.pending.get(index);
            if (pending) return pending.promise;

            const controller = new AbortController();
            const promise = this.fetchPage(index, controller.signal).finally(() => this.pending.delete(index));
            this.pending.set(index, { controller, promise });
            return promise;
        }

        async fetchPage(index, signal) {
            const url = this.apiClient.getUrl(`AdvancedBooks/Books/${encodeURIComponent(this.itemId)}/Pages/${index}`);
            const response = await this.apiClient.fetch({ url, method: 'GET', signal }, true);
            if (!response || response.ok === false) throw new Error(`HTTP ${response?.status ?? 'error'}`);
            const blob = await response.blob();
            const objectUrl = URL.createObjectURL(blob);
            if (this.closed) {
                URL.revokeObjectURL(objectUrl);
                throw new Error('Reader closed');
            }
            this.cache.set(index, objectUrl);
            this.trimCache(index);
            return objectUrl;
        }

        prefetchPaged() {
            const step = this.pageStep();
            const candidates = [this.currentPage - step, this.currentPage + step, this.currentPage + step + (this.layout === 'double' ? 1 : 0)];
            for (const index of candidates) {
                if (index >= 0 && index < this.pageCount && !this.cache.has(index) && !this.pending.has(index)) {
                    this.loadPage(index).catch(() => {});
                }
            }
        }

        trimPendingContinuous() {
            for (const [index, pending] of this.pending) {
                if (Math.abs(index - this.currentPage) > continuousKeepRadius + 2) pending.controller.abort();
            }
        }

        trimCache(extraProtectedIndex) {
            const limit = this.isContinuous() ? continuousCacheLimit : pagedCacheLimit;
            if (this.cache.size <= limit) return;

            const protectedIndexes = new Set();
            if (this.isContinuous()) {
                for (let index = Math.max(0, this.currentPage - continuousKeepRadius); index <= Math.min(this.pageCount - 1, this.currentPage + continuousKeepRadius); index++) {
                    protectedIndexes.add(index);
                }
                for (const index of this.visibleRatios.keys()) protectedIndexes.add(index);
            } else {
                for (const index of this.visibleIndexes()) protectedIndexes.add(index);
            }
            if (Number.isInteger(extraProtectedIndex)) protectedIndexes.add(extraProtectedIndex);

            const candidates = Array.from(this.cache.keys())
                .filter(index => !protectedIndexes.has(index))
                .sort((a, b) => Math.abs(b - this.currentPage) - Math.abs(a - this.currentPage));

            while (this.cache.size > limit && candidates.length > 0) this.evictPage(candidates.shift());
        }

        evictPage(index) {
            const objectUrl = this.cache.get(index);
            if (!objectUrl) return;
            const slot = this.continuousElements[index];
            if (slot?.isConnected) this.ensurePlaceholder(slot, index);
            URL.revokeObjectURL(objectUrl);
            this.cache.delete(index);
        }

        updateControls() {
            this.previousButton.disabled = this.currentPage <= 0;
            this.nextButton.disabled = this.currentPage + this.pageStep() >= this.pageCount;
            if (this.layout === 'double' && this.currentPage + 1 < this.pageCount) {
                this.counter.textContent = `${this.currentPage + 1}–${this.currentPage + 2} / ${this.pageCount}`;
            } else {
                this.counter.textContent = `${this.currentPage + 1} / ${this.pageCount}`;
            }

            if (this.pageSlider) {
                this.pageSlider.max = String(Math.max(1, this.pageCount));
                this.pageSlider.step = this.layout === 'double' ? '2' : '1';
                this.pageSlider.value = String(Math.min(this.pageCount, this.currentPage + 1));
                this.pageSlider.setAttribute('aria-valuetext', this.counter.textContent);
                this.pageSlider.dir = !this.isContinuous() && this.direction === 'rtl' ? 'rtl' : 'ltr';
                if (!this.sliderPreview?.hidden) this.positionSliderPreview(Number(this.pageSlider.value) - 1);
            }
            if (this.pageSliderValue) this.pageSliderValue.textContent = this.counter.textContent;
            const reachedPage = this.layout === 'double'
                ? Math.min(this.pageCount - 1, this.currentPage + 1)
                : this.currentPage;
            const progress = this.pageCount <= 1 ? 100 : (reachedPage / (this.pageCount - 1)) * 100;
            this.overlay?.style.setProperty('--ab-progress', `${Math.max(0, Math.min(100, progress))}%`);
        }

        setZoom(value) {
            const anchor = this.isContinuous() && this.continuousElements[this.currentPage]
                ? {
                    element: this.continuousElements[this.currentPage],
                    viewportOffset: this.continuousElements[this.currentPage].offsetTop - this.stage.scrollTop
                }
                : null;

            this.zoom = Math.min(4, Math.max(.5, Math.round(value * 20) / 20));
            if (this.zoom <= 1) { this.panX = 0; this.panY = 0; }
            this.applyTransform();
            this.syncControlState();

            if (anchor?.element?.isConnected) {
                requestAnimationFrame(() => {
                    if (!this.closed && anchor.element.isConnected) {
                        this.stage.scrollTop = Math.max(0, anchor.element.offsetTop - anchor.viewportOffset);
                    }
                });
            }
        }

        resetPan() { this.panX = 0; this.panY = 0; }
        resetTransform() { this.zoom = 1; this.resetPan(); }

        applyTransform() {
            if (this.isContinuous()) {
                this.pagesElement.className = `advancedBooksReaderPages ab-continuous ab-layout-${this.layout} ab-fit-${this.fit}`;
                this.pagesElement.style.transform = 'none';
                this.pagesElement.style.setProperty('--ab-side-padding', `${this.sidePadding}vw`);
                this.pagesElement.style.setProperty('--ab-page-gap', `${this.pageGap}px`);
                const scalableCanvas = this.fit === 'screen' || this.fit === 'width';
                this.pagesElement.style.width = scalableCanvas ? `${Math.round(this.zoom * 100)}%` : '100%';
                this.pagesElement.style.minWidth = scalableCanvas && this.zoom >= 1
                    ? `${Math.round(this.zoom * 100)}%`
                    : '0';
                this.pagesElement.style.cursor = this.zoom > 1 ? 'grab' : 'default';
                this.stage.style.touchAction = 'pan-y';
                this.zoomResetButton.textContent = `${Math.round(this.zoom * 100)}%`;
                this.refreshContinuousImageSizing();
                return;
            }
            this.pagesElement.style.width = '';
            this.pagesElement.style.minWidth = '';
            this.pagesElement.style.removeProperty('--ab-side-padding');
            this.pagesElement.style.removeProperty('--ab-page-gap');
            this.pagesElement.className = `advancedBooksReaderPages ab-layout-${this.layout} ab-fit-${this.fit}`;
            this.pagesElement.style.transform = `translate(${this.panX}px,${this.panY}px) scale(${this.zoom})`;
            this.pagesElement.style.cursor = this.zoom > 1 ? 'grab' : 'default';
            this.stage.style.touchAction = this.zoom > 1 ? 'none' : 'pan-y';
            this.zoomResetButton.textContent = `${Math.round(this.zoom * 100)}%`;
        }

        onKeyDown(event) {
            if (!this.overlay?.isConnected) return;
            if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                if (this.settingsOpen) this.toggleSettings(false);
                else this.close();
                return;
            }
            if (event.ctrlKey || event.altKey || event.metaKey) return;
            if (event.target?.closest?.('input,select,button')) {
                this.showControls();
                return;
            }

            this.showControls();

            if (event.key.toLowerCase() === 'f') { event.preventDefault(); this.toggleFullscreen(); return; }
            if (event.key === '+' || event.key === '=') { event.preventDefault(); this.setZoom(this.zoom + .25); return; }
            if (event.key === '-') { event.preventDefault(); this.setZoom(this.zoom - .25); return; }
            if (event.key === '0') { event.preventDefault(); this.setZoom(1); return; }

            if (this.isContinuous()) {
                if (event.key === 'ArrowUp' || event.key === 'PageUp') { event.preventDefault(); this.previous(); }
                else if (event.key === 'ArrowDown' || event.key === 'PageDown' || event.key === ' ') { event.preventDefault(); this.next(); }
                else if (event.key === 'Home') { event.preventDefault(); this.goTo(0); }
                else if (event.key === 'End') { event.preventDefault(); this.goTo(this.pageCount - 1); }
                return;
            }

            const rtl = this.direction === 'rtl';
            if (event.key === 'ArrowLeft') { event.preventDefault(); rtl ? this.next() : this.previous(); }
            else if (event.key === 'ArrowRight') { event.preventDefault(); rtl ? this.previous() : this.next(); }
            else if (event.key === 'PageUp') { event.preventDefault(); this.previous(); }
            else if (event.key === 'PageDown' || event.key === ' ') { event.preventDefault(); this.next(); }
            else if (event.key === 'Home') { event.preventDefault(); this.goTo(0); }
            else if (event.key === 'End') { event.preventDefault(); this.goTo(this.pageCount - 1); }
        }

        onWheel(event) {
            if (event.ctrlKey) {
                event.preventDefault();
                this.setZoom(this.zoom + (event.deltaY < 0 ? .15 : -.15));
                return;
            }
            if (this.isContinuous()) return;
            if (this.zoom > 1) {
                event.preventDefault();
                this.setZoom(this.zoom + (event.deltaY < 0 ? .15 : -.15));
                return;
            }
            if (this.fit !== 'screen' || Math.abs(event.deltaY) < 25) return;
            const now = Date.now();
            if (now - this.lastWheelNavigation < 250) { event.preventDefault(); return; }
            event.preventDefault();
            this.lastWheelNavigation = now;
            event.deltaY > 0 ? this.next() : this.previous();
        }

        onPointerDown(event) {
            if (this.isContinuous()) {
                if (this.zoom > 1 && event.pointerType !== 'touch' && (event.button ?? 0) === 0) {
                    this.pointerStart = {
                        id: event.pointerId,
                        x: event.clientX,
                        y: event.clientY,
                        continuous: true,
                        scrollLeft: this.stage.scrollLeft,
                        scrollTop: this.stage.scrollTop
                    };
                    this.stage.setPointerCapture?.(event.pointerId);
                    this.pagesElement.style.cursor = 'grabbing';
                    event.preventDefault();
                }
                return;
            }
            this.pointerStart = { id:event.pointerId,x:event.clientX,y:event.clientY,panX:this.panX,panY:this.panY };
            this.stage.setPointerCapture?.(event.pointerId);
            if (this.zoom > 1) this.pagesElement.style.cursor = 'grabbing';
        }

        onPointerMove(event) {
            if (!this.pointerStart || event.pointerId !== this.pointerStart.id) return;
            if (this.pointerStart.continuous) {
                event.preventDefault();
                this.stage.scrollLeft = this.pointerStart.scrollLeft - (event.clientX - this.pointerStart.x);
                this.stage.scrollTop = this.pointerStart.scrollTop - (event.clientY - this.pointerStart.y);
                return;
            }
            if (this.isContinuous() || this.zoom <= 1) return;
            event.preventDefault();
            this.panX = this.pointerStart.panX + event.clientX - this.pointerStart.x;
            this.panY = this.pointerStart.panY + event.clientY - this.pointerStart.y;
            this.applyTransform();
            this.pagesElement.style.cursor = 'grabbing';
        }

        onPointerUp(event) {
            if (!this.pointerStart || event.pointerId !== this.pointerStart.id) return;
            const start = this.pointerStart;
            this.pointerStart = null;
            this.stage.releasePointerCapture?.(event.pointerId);

            if (start.continuous) {
                const moved = Math.hypot(event.clientX - start.x, event.clientY - start.y);
                if (moved > 8) this.suppressNextStageClick = true;
                this.applyTransform();
                return;
            }
            if (this.isContinuous()) return;

            this.applyTransform();

            const deltaX = event.clientX - start.x;
            const deltaY = event.clientY - start.y;
            if (this.zoom > 1) {
                if (Math.abs(deltaX) < 8 && Math.abs(deltaY) < 8) this.toggleControls();
                return;
            }
            if (Math.abs(deltaX) > 55 && Math.abs(deltaX) > Math.abs(deltaY)) {
                const swipeLeft = deltaX < 0;
                if (this.direction === 'rtl') swipeLeft ? this.previous() : this.next();
                else swipeLeft ? this.next() : this.previous();
                return;
            }
            if (Math.abs(deltaX) < 8 && Math.abs(deltaY) < 8) {
                const rect = this.stage.getBoundingClientRect();
                const ratio = (event.clientX - rect.left) / Math.max(1, rect.width);
                if (ratio >= .32 && ratio <= .68) {
                    this.toggleControls();
                    return;
                }
                const leftSide = ratio < .32;
                if (this.direction === 'rtl') leftSide ? this.next() : this.previous();
                else leftSide ? this.previous() : this.next();
            }
        }
    }

    document.addEventListener('viewshow', scheduleAttach);
    window.addEventListener('hashchange', scheduleAttach);
    window.addEventListener('popstate', scheduleAttach);
    new MutationObserver(scheduleAttach).observe(document.documentElement, { childList: true, subtree: true });
    scheduleAttach();
}());
