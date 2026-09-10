(function () {
    'use strict';

    if (window.__jellyfinAdvancedBooksReaderLoaded) {
        return;
    }

    window.__jellyfinAdvancedBooksReaderLoaded = true;

    const metadataCache = new Map();
    const cacheLimit = 8;
    let attachSequence = 0;
    let attachTimer = null;
    let activeReader = null;

    function getApiClient() {
        const apiClient = window.ApiClient;
        if (!apiClient || typeof apiClient.getUrl !== 'function') {
            return null;
        }

        return apiClient;
    }

    function getCurrentItemId() {
        const directId = new URLSearchParams(window.location.search).get('id');
        if (directId) {
            return directId;
        }

        const hash = window.location.hash || '';
        const questionIndex = hash.indexOf('?');
        if (questionIndex >= 0) {
            const hashParams = new URLSearchParams(hash.slice(questionIndex + 1));
            const hashId = hashParams.get('id');
            if (hashId) {
                return hashId;
            }
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
        const existing = metadataCache.get(itemId);
        if (existing) {
            return existing;
        }

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
        button.className = 'button-flat detailButton advancedBooksReaderButton';
        button.dataset.advancedBooksItemId = itemId;
        button.title = 'Advanced Reader';
        button.setAttribute('aria-label', 'Open Advanced Reader');

        const content = document.createElement('div');
        content.className = 'detailButton-content';

        const icon = document.createElement('span');
        icon.className = 'material-icons detailButton-icon menu_book';
        icon.setAttribute('aria-hidden', 'true');
        icon.textContent = 'menu_book';

        const text = document.createElement('div');
        text.className = 'detailButton-text';
        text.textContent = 'Advanced Reader';

        content.appendChild(icon);
        button.append(content, text);
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

        if (!host) {
            return;
        }

        const existingButton = host.querySelector('.advancedBooksReaderButton');
        if (existingButton?.dataset.advancedBooksItemId === itemId) {
            return;
        }
        existingButton?.remove();

        try {
            const metadata = await getMetadata(itemId);
            if (sequence !== attachSequence || itemId !== getCurrentItemId() || metadata.pages.length === 0) {
                return;
            }

            const currentHost = Array.from(document.querySelectorAll('.mainDetailButtons'))
                .find(element => element.offsetParent !== null)
                ?? document.querySelector('.mainDetailButtons');
            if (!currentHost) {
                return;
            }

            currentHost.querySelector('.advancedBooksReaderButton')?.remove();
            currentHost.appendChild(createReaderButton(itemId, metadata));
        } catch {
            // Unsupported, inaccessible and safety-rejected books intentionally receive no reader button.
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
            this.pageCount = metadata.pages.length;
            this.currentPage = 0;
            this.layout = 'single';
            this.direction = 'rtl';
            this.fit = 'screen';
            this.zoom = 1;
            this.panX = 0;
            this.panY = 0;
            this.renderSequence = 0;
            this.cache = new Map();
            this.pending = new Map();
            this.previousBodyOverflow = document.body.style.overflow;
            this.pointerStart = null;
            this.lastWheelNavigation = 0;
            this.boundKeyDown = event => this.onKeyDown(event);
            this.boundWheel = event => this.onWheel(event);
            this.boundPointerDown = event => this.onPointerDown(event);
            this.boundPointerMove = event => this.onPointerMove(event);
            this.boundPointerUp = event => this.onPointerUp(event);
        }

        async open() {
            if (!this.apiClient || this.pageCount === 0) {
                return;
            }

            this.ensureStyles();
            this.buildUi();
            this.bindEvents();
            document.body.style.overflow = 'hidden';
            await this.render();
        }

        close() {
            this.unbindEvents();
            for (const pending of this.pending.values()) {
                pending.controller.abort();
            }
            this.pending.clear();

            for (const objectUrl of this.cache.values()) {
                URL.revokeObjectURL(objectUrl);
            }
            this.cache.clear();

            this.overlay?.remove();
            document.body.style.overflow = this.previousBodyOverflow;
            if (activeReader === this) {
                activeReader = null;
            }
        }

        ensureStyles() {
            if (document.getElementById('advancedBooksReaderStyles')) {
                return;
            }

            const style = document.createElement('style');
            style.id = 'advancedBooksReaderStyles';
            style.textContent = `
                .advancedBooksReaderOverlay {
                    position: fixed;
                    inset: 0;
                    z-index: 2147483000;
                    display: flex;
                    flex-direction: column;
                    background: #080808;
                    color: #fff;
                    font-family: inherit;
                }
                .advancedBooksReaderToolbar {
                    min-height: 3.5rem;
                    display: flex;
                    flex-wrap: wrap;
                    align-items: center;
                    gap: .45rem;
                    padding: .45rem .65rem;
                    background: rgba(20, 20, 20, .96);
                    box-sizing: border-box;
                    z-index: 2;
                }
                .advancedBooksReaderToolbar button,
                .advancedBooksReaderToolbar select {
                    min-height: 2.35rem;
                    border: 1px solid rgba(255,255,255,.2);
                    border-radius: .35rem;
                    background: #252525;
                    color: #fff;
                    padding: .35rem .7rem;
                    font: inherit;
                }
                .advancedBooksReaderToolbar button:disabled {
                    opacity: .4;
                }
                .advancedBooksReaderSpacer {
                    flex: 1 1 auto;
                }
                .advancedBooksReaderCounter {
                    min-width: 7rem;
                    text-align: center;
                    font-variant-numeric: tabular-nums;
                }
                .advancedBooksReaderStage {
                    position: relative;
                    flex: 1 1 auto;
                    min-height: 0;
                    overflow: auto;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: #080808;
                    touch-action: pan-y;
                    user-select: none;
                }
                .advancedBooksReaderPages {
                    min-width: 100%;
                    min-height: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: .4rem;
                    transform-origin: center center;
                    will-change: transform;
                    box-sizing: border-box;
                    padding: .4rem;
                }
                .advancedBooksReaderPages img {
                    display: block;
                    object-fit: contain;
                    flex: 0 1 auto;
                    box-shadow: 0 0 20px rgba(0,0,0,.35);
                }
                .advancedBooksReaderPages.ab-fit-screen img {
                    max-width: calc(100vw - 1rem);
                    max-height: calc(100vh - 4.7rem);
                    width: auto;
                    height: auto;
                }
                .advancedBooksReaderPages.ab-layout-double.ab-fit-screen img {
                    max-width: calc(50vw - .7rem);
                }
                .advancedBooksReaderPages.ab-fit-width {
                    align-items: flex-start;
                }
                .advancedBooksReaderPages.ab-fit-width img {
                    width: calc(100vw - 1rem);
                    max-width: none;
                    height: auto;
                }
                .advancedBooksReaderPages.ab-layout-double.ab-fit-width img {
                    width: calc(50vw - .7rem);
                }
                .advancedBooksReaderPages.ab-fit-height img {
                    height: calc(100vh - 4.7rem);
                    max-height: none;
                    width: auto;
                }
                .advancedBooksReaderPages.ab-fit-original img {
                    max-width: none;
                    max-height: none;
                    width: auto;
                    height: auto;
                }
                .advancedBooksReaderMessage {
                    position: absolute;
                    inset: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    pointer-events: none;
                    font-size: 1.05rem;
                    color: rgba(255,255,255,.82);
                    padding: 1rem;
                    text-align: center;
                }
                @media (max-width: 700px) {
                    .advancedBooksReaderToolbar {
                        gap: .3rem;
                        padding: .3rem;
                    }
                    .advancedBooksReaderToolbar button,
                    .advancedBooksReaderToolbar select {
                        min-height: 2.15rem;
                        padding: .25rem .5rem;
                    }
                    .advancedBooksReaderCounter {
                        min-width: 5.5rem;
                    }
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

            const toolbar = document.createElement('div');
            toolbar.className = 'advancedBooksReaderToolbar';

            const closeButton = this.makeButton('Close', () => this.close());
            closeButton.title = 'Close (Esc)';
            this.previousButton = this.makeButton('Previous', () => this.previous());
            this.nextButton = this.makeButton('Next', () => this.next());

            this.layoutSelect = this.makeSelect([
                ['single', 'Single page'],
                ['double', 'Double page']
            ], this.layout, value => {
                this.layout = value;
                this.currentPage = this.alignPage(this.currentPage);
                this.resetTransform();
                this.render();
            });

            this.directionSelect = this.makeSelect([
                ['rtl', 'Right to left'],
                ['ltr', 'Left to right']
            ], this.direction, value => {
                this.direction = value;
                this.resetTransform();
                this.render();
            });

            this.fitSelect = this.makeSelect([
                ['screen', 'Fit screen'],
                ['width', 'Fit width'],
                ['height', 'Fit height'],
                ['original', 'Original size']
            ], this.fit, value => {
                this.fit = value;
                this.resetTransform();
                this.applyTransform();
            });

            const zoomOut = this.makeButton('−', () => this.setZoom(this.zoom - .25));
            zoomOut.title = 'Zoom out';
            this.zoomResetButton = this.makeButton('100%', () => this.setZoom(1));
            this.zoomResetButton.title = 'Reset zoom';
            const zoomIn = this.makeButton('+', () => this.setZoom(this.zoom + .25));
            zoomIn.title = 'Zoom in';

            const spacer = document.createElement('div');
            spacer.className = 'advancedBooksReaderSpacer';

            this.counter = document.createElement('div');
            this.counter.className = 'advancedBooksReaderCounter';

            toolbar.append(
                closeButton,
                this.previousButton,
                this.nextButton,
                this.layoutSelect,
                this.directionSelect,
                this.fitSelect,
                zoomOut,
                this.zoomResetButton,
                zoomIn,
                spacer,
                this.counter
            );

            this.stage = document.createElement('div');
            this.stage.className = 'advancedBooksReaderStage';

            this.pagesElement = document.createElement('div');
            this.pagesElement.className = 'advancedBooksReaderPages';

            this.message = document.createElement('div');
            this.message.className = 'advancedBooksReaderMessage';

            this.stage.append(this.pagesElement, this.message);
            this.overlay.append(toolbar, this.stage);
            document.body.appendChild(this.overlay);
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

        bindEvents() {
            document.addEventListener('keydown', this.boundKeyDown, true);
            this.stage.addEventListener('wheel', this.boundWheel, { passive: false });
            this.stage.addEventListener('pointerdown', this.boundPointerDown);
            this.stage.addEventListener('pointermove', this.boundPointerMove);
            this.stage.addEventListener('pointerup', this.boundPointerUp);
            this.stage.addEventListener('pointercancel', this.boundPointerUp);
        }

        unbindEvents() {
            document.removeEventListener('keydown', this.boundKeyDown, true);
            this.stage?.removeEventListener('wheel', this.boundWheel);
            this.stage?.removeEventListener('pointerdown', this.boundPointerDown);
            this.stage?.removeEventListener('pointermove', this.boundPointerMove);
            this.stage?.removeEventListener('pointerup', this.boundPointerUp);
            this.stage?.removeEventListener('pointercancel', this.boundPointerUp);
        }

        pageStep() {
            return this.layout === 'double' ? 2 : 1;
        }

        alignPage(index) {
            return this.layout === 'double' ? Math.floor(index / 2) * 2 : index;
        }

        previous() {
            this.goTo(this.currentPage - this.pageStep());
        }

        next() {
            this.goTo(this.currentPage + this.pageStep());
        }

        goTo(index) {
            const maximum = Math.max(0, this.pageCount - 1);
            const aligned = this.alignPage(Math.min(maximum, Math.max(0, index)));
            if (aligned === this.currentPage) {
                return;
            }

            this.currentPage = aligned;
            this.resetTransform();
            this.render();
        }

        visibleIndexes() {
            const indexes = [this.currentPage];
            if (this.layout === 'double' && this.currentPage + 1 < this.pageCount) {
                indexes.push(this.currentPage + 1);
            }
            if (this.direction === 'rtl' && indexes.length > 1) {
                indexes.reverse();
            }
            return indexes;
        }

        async render() {
            const sequence = ++this.renderSequence;
            this.message.textContent = 'Loading page…';
            this.updateControls();

            try {
                const indexes = this.visibleIndexes();
                const urls = await Promise.all(indexes.map(index => this.loadPage(index)));
                if (sequence !== this.renderSequence || !this.overlay?.isConnected) {
                    return;
                }

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
                this.prefetchNearby();
                this.trimCache();
            } catch (error) {
                if (sequence === this.renderSequence) {
                    this.message.textContent = `Unable to load page: ${error?.message ?? 'Unknown error'}`;
                }
            }
        }

        async loadPage(index) {
            if (this.cache.has(index)) {
                return this.cache.get(index);
            }

            const pending = this.pending.get(index);
            if (pending) {
                return pending.promise;
            }

            const controller = new AbortController();
            const promise = this.fetchPage(index, controller.signal)
                .finally(() => this.pending.delete(index));
            this.pending.set(index, { controller, promise });
            return promise;
        }

        async fetchPage(index, signal) {
            const url = this.apiClient.getUrl(
                `AdvancedBooks/Books/${encodeURIComponent(this.itemId)}/Pages/${index}`);
            const response = await this.apiClient.fetch({ url, method: 'GET', signal }, true);
            if (!response || response.ok === false) {
                throw new Error(`HTTP ${response?.status ?? 'error'}`);
            }

            const blob = await response.blob();
            const objectUrl = URL.createObjectURL(blob);
            this.cache.set(index, objectUrl);
            this.trimCache();
            return objectUrl;
        }

        prefetchNearby() {
            const step = this.pageStep();
            const candidates = [
                this.currentPage - step,
                this.currentPage + step,
                this.currentPage + step + (this.layout === 'double' ? 1 : 0)
            ];

            for (const index of candidates) {
                if (index >= 0 && index < this.pageCount && !this.cache.has(index) && !this.pending.has(index)) {
                    this.loadPage(index).catch(() => { });
                }
            }
        }

        trimCache() {
            if (this.cache.size <= cacheLimit) {
                return;
            }

            const visible = new Set(this.visibleIndexes());
            const distance = index => Math.min(...Array.from(visible, visibleIndex => Math.abs(visibleIndex - index)));
            const cachedIndexes = Array.from(this.cache.keys()).sort((a, b) => distance(a) - distance(b));
            const keep = new Set(cachedIndexes.slice(0, cacheLimit));

            for (const [index, objectUrl] of this.cache) {
                if (!keep.has(index)) {
                    URL.revokeObjectURL(objectUrl);
                    this.cache.delete(index);
                }
            }
        }

        updateControls() {
            const step = this.pageStep();
            this.previousButton.disabled = this.currentPage <= 0;
            this.nextButton.disabled = this.currentPage + step >= this.pageCount;

            if (this.layout === 'double' && this.currentPage + 1 < this.pageCount) {
                this.counter.textContent = `${this.currentPage + 1}–${this.currentPage + 2} / ${this.pageCount}`;
            } else {
                this.counter.textContent = `${this.currentPage + 1} / ${this.pageCount}`;
            }
        }

        setZoom(value) {
            this.zoom = Math.min(4, Math.max(.5, Math.round(value * 100) / 100));
            if (this.zoom === 1) {
                this.panX = 0;
                this.panY = 0;
            }
            this.applyTransform();
        }

        resetTransform() {
            this.zoom = 1;
            this.panX = 0;
            this.panY = 0;
        }

        applyTransform() {
            if (!this.pagesElement) {
                return;
            }

            this.pagesElement.className = `advancedBooksReaderPages ab-layout-${this.layout} ab-fit-${this.fit}`;
            this.pagesElement.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoom})`;
            this.pagesElement.style.cursor = this.zoom > 1 ? 'grab' : 'default';
            this.stage.style.touchAction = this.zoom > 1 ? 'none' : 'pan-y';
            this.zoomResetButton.textContent = `${Math.round(this.zoom * 100)}%`;
        }

        onKeyDown(event) {
            if (!this.overlay?.isConnected) {
                return;
            }

            if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                this.close();
                return;
            }

            if (event.ctrlKey || event.altKey || event.metaKey) {
                return;
            }

            const rtl = this.direction === 'rtl';
            if (event.key === 'ArrowLeft') {
                event.preventDefault();
                rtl ? this.next() : this.previous();
            } else if (event.key === 'ArrowRight') {
                event.preventDefault();
                rtl ? this.previous() : this.next();
            } else if (event.key === 'PageUp') {
                event.preventDefault();
                this.previous();
            } else if (event.key === 'PageDown' || event.key === ' ') {
                event.preventDefault();
                this.next();
            } else if (event.key === 'Home') {
                event.preventDefault();
                this.goTo(0);
            } else if (event.key === 'End') {
                event.preventDefault();
                this.goTo(this.pageCount - 1);
            } else if (event.key === '+' || event.key === '=') {
                event.preventDefault();
                this.setZoom(this.zoom + .25);
            } else if (event.key === '-') {
                event.preventDefault();
                this.setZoom(this.zoom - .25);
            } else if (event.key === '0') {
                event.preventDefault();
                this.setZoom(1);
            }
        }

        onWheel(event) {
            if (event.ctrlKey || this.zoom > 1) {
                event.preventDefault();
                this.setZoom(this.zoom + (event.deltaY < 0 ? .15 : -.15));
                return;
            }

            if (this.fit !== 'screen' || Math.abs(event.deltaY) < 25) {
                return;
            }

            const now = Date.now();
            if (now - this.lastWheelNavigation < 250) {
                event.preventDefault();
                return;
            }

            event.preventDefault();
            this.lastWheelNavigation = now;
            event.deltaY > 0 ? this.next() : this.previous();
        }

        onPointerDown(event) {
            this.pointerStart = {
                id: event.pointerId,
                x: event.clientX,
                y: event.clientY,
                panX: this.panX,
                panY: this.panY
            };
            this.stage.setPointerCapture?.(event.pointerId);
            if (this.zoom > 1) {
                this.pagesElement.style.cursor = 'grabbing';
            }
        }

        onPointerMove(event) {
            if (!this.pointerStart || event.pointerId !== this.pointerStart.id || this.zoom <= 1) {
                return;
            }

            event.preventDefault();
            this.panX = this.pointerStart.panX + event.clientX - this.pointerStart.x;
            this.panY = this.pointerStart.panY + event.clientY - this.pointerStart.y;
            this.applyTransform();
            this.pagesElement.style.cursor = 'grabbing';
        }

        onPointerUp(event) {
            if (!this.pointerStart || event.pointerId !== this.pointerStart.id) {
                return;
            }

            const start = this.pointerStart;
            this.pointerStart = null;
            this.stage.releasePointerCapture?.(event.pointerId);
            this.applyTransform();

            if (this.zoom > 1) {
                return;
            }

            const deltaX = event.clientX - start.x;
            const deltaY = event.clientY - start.y;
            if (Math.abs(deltaX) > 55 && Math.abs(deltaX) > Math.abs(deltaY)) {
                const swipeLeft = deltaX < 0;
                if (this.direction === 'rtl') {
                    swipeLeft ? this.previous() : this.next();
                } else {
                    swipeLeft ? this.next() : this.previous();
                }
                return;
            }

            if (Math.abs(deltaX) < 8 && Math.abs(deltaY) < 8) {
                const rect = this.stage.getBoundingClientRect();
                const leftHalf = event.clientX < rect.left + rect.width / 2;
                if (this.direction === 'rtl') {
                    leftHalf ? this.next() : this.previous();
                } else {
                    leftHalf ? this.previous() : this.next();
                }
            }
        }
    }

    document.addEventListener('viewshow', scheduleAttach);
    window.addEventListener('hashchange', scheduleAttach);
    window.addEventListener('popstate', scheduleAttach);

    const observer = new MutationObserver(scheduleAttach);
    observer.observe(document.documentElement, { childList: true, subtree: true });
    scheduleAttach();
}());
