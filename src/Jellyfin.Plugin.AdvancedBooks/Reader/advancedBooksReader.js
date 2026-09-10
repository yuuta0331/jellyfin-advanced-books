(function () {
    'use strict';

    if (window.__jellyfinAdvancedBooksReaderLoaded) return;
    window.__jellyfinAdvancedBooksReaderLoaded = true;

    const metadataCache = new Map();
    const pagedCacheLimit = 8;
    const continuousCacheLimit = 12;
    const continuousKeepRadius = 5;
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
        content.appendChild(icon);

        const text = document.createElement('div');
        text.className = 'detailButton-text';
        text.textContent = 'Advanced Reader';
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
            this.continuousElements = [];
            this.visibleRatios = new Map();
            this.loadObserver = null;
            this.visibilityObserver = null;
            this.previousBodyOverflow = document.body.style.overflow;
            this.pointerStart = null;
            this.lastWheelNavigation = 0;
            this.closed = false;
            this.boundKeyDown = event => this.onKeyDown(event);
            this.boundWheel = event => this.onWheel(event);
            this.boundPointerDown = event => this.onPointerDown(event);
            this.boundPointerMove = event => this.onPointerMove(event);
            this.boundPointerUp = event => this.onPointerUp(event);
        }

        async open() {
            if (!this.apiClient || this.pageCount === 0) return;
            this.closed = false;
            this.ensureStyles();
            this.buildUi();
            this.bindEvents();
            document.body.style.overflow = 'hidden';
            await this.render();
        }

        close() {
            if (this.closed) return;
            this.closed = true;
            this.teardownContinuous();
            this.unbindEvents();

            for (const pending of this.pending.values()) pending.controller.abort();
            this.pending.clear();
            for (const objectUrl of this.cache.values()) URL.revokeObjectURL(objectUrl);
            this.cache.clear();

            this.overlay?.remove();
            document.body.style.overflow = this.previousBodyOverflow;
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
                .advancedBooksReaderOverlay{position:fixed;inset:0;z-index:2147483000;display:flex;flex-direction:column;background:#080808;color:#fff;font-family:inherit}
                .advancedBooksReaderToolbar{min-height:3.5rem;display:flex;flex-wrap:wrap;align-items:center;gap:.45rem;padding:.45rem .65rem;background:rgba(20,20,20,.96);box-sizing:border-box;z-index:2}
                .advancedBooksReaderToolbar button,.advancedBooksReaderToolbar select{min-height:2.35rem;border:1px solid rgba(255,255,255,.2);border-radius:.35rem;background:#252525;color:#fff;padding:.35rem .7rem;font:inherit}
                .advancedBooksReaderToolbar button:disabled,.advancedBooksReaderToolbar select:disabled{opacity:.4}
                .advancedBooksReaderSpacer{flex:1 1 auto}.advancedBooksReaderCounter{min-width:7rem;text-align:center;font-variant-numeric:tabular-nums}
                .advancedBooksReaderStage{position:relative;flex:1 1 auto;min-height:0;overflow:auto;display:flex;align-items:center;justify-content:center;background:#080808;touch-action:pan-y;user-select:none;overscroll-behavior:contain}
                .advancedBooksReaderPages{min-width:100%;min-height:100%;display:flex;align-items:center;justify-content:center;gap:.4rem;transform-origin:center center;will-change:transform;box-sizing:border-box;padding:.4rem}
                .advancedBooksReaderPages img{display:block;object-fit:contain;flex:0 1 auto;box-shadow:0 0 20px rgba(0,0,0,.35)}
                .advancedBooksReaderPages.ab-fit-screen img{max-width:calc(100vw - 1rem);max-height:calc(100vh - 4.7rem);width:auto;height:auto}
                .advancedBooksReaderPages.ab-layout-double.ab-fit-screen img{max-width:calc(50vw - .7rem)}
                .advancedBooksReaderPages.ab-fit-width{align-items:flex-start}.advancedBooksReaderPages.ab-fit-width img{width:calc(100vw - 1rem);max-width:none;height:auto}
                .advancedBooksReaderPages.ab-layout-double.ab-fit-width img{width:calc(50vw - .7rem)}
                .advancedBooksReaderPages.ab-fit-height img{height:calc(100vh - 4.7rem);max-height:none;width:auto}
                .advancedBooksReaderPages.ab-fit-original img{max-width:none;max-height:none;width:auto;height:auto}
                .advancedBooksReaderStage.ab-continuous{display:block;align-items:initial;justify-content:initial;touch-action:pan-y}
                .advancedBooksReaderPages.ab-continuous{min-height:auto;min-width:100%;width:100%;display:flex;flex-direction:column;justify-content:flex-start;align-items:center;transform:none!important;will-change:auto;padding:.5rem 0;gap:.75rem}
                .advancedBooksReaderPages.ab-layout-webtoon{gap:0;padding:0}
                .advancedBooksReaderPageSlot{width:100%;min-height:55vh;display:flex;align-items:center;justify-content:center;position:relative;box-sizing:border-box}
                .advancedBooksReaderPages.ab-layout-webtoon .advancedBooksReaderPageSlot{min-height:30vh}
                .advancedBooksReaderPagePlaceholder{display:flex;align-items:center;justify-content:center;width:100%;min-height:inherit;color:rgba(255,255,255,.35);font-variant-numeric:tabular-nums}
                .advancedBooksReaderPages.ab-continuous.ab-fit-screen img{max-width:calc(100vw - 1rem);max-height:none;width:auto;height:auto}
                .advancedBooksReaderPages.ab-continuous.ab-fit-width img{width:100%;max-width:100%;height:auto}
                .advancedBooksReaderPages.ab-continuous.ab-fit-height img{height:calc(100vh - 4.7rem);max-height:none;width:auto;max-width:100%}
                .advancedBooksReaderPages.ab-continuous.ab-fit-original img{max-width:none;max-height:none;width:auto;height:auto}
                .advancedBooksReaderPages.ab-layout-webtoon img{width:100%;max-width:100%;height:auto;box-shadow:none}
                .advancedBooksReaderMessage{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;font-size:1.05rem;color:rgba(255,255,255,.82);padding:1rem;text-align:center}
                @media(max-width:700px){.advancedBooksReaderToolbar{gap:.3rem;padding:.3rem}.advancedBooksReaderToolbar button,.advancedBooksReaderToolbar select{min-height:2.15rem;padding:.25rem .5rem}.advancedBooksReaderCounter{min-width:5.5rem}.advancedBooksReaderPageSlot{min-height:45vh}}
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
                ['double', 'Double page'],
                ['vertical', 'Vertical continuous'],
                ['webtoon', 'Webtoon']
            ], this.layout, value => this.setLayout(value));

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
                this.render();
            });

            this.zoomOutButton = this.makeButton('−', () => this.setZoom(this.zoom - .25));
            this.zoomOutButton.title = 'Zoom out';
            this.zoomResetButton = this.makeButton('100%', () => this.setZoom(1));
            this.zoomResetButton.title = 'Reset zoom';
            this.zoomInButton = this.makeButton('+', () => this.setZoom(this.zoom + .25));
            this.zoomInButton.title = 'Zoom in';

            const spacer = document.createElement('div');
            spacer.className = 'advancedBooksReaderSpacer';
            this.counter = document.createElement('div');
            this.counter.className = 'advancedBooksReaderCounter';

            toolbar.append(closeButton,this.previousButton,this.nextButton,this.layoutSelect,this.directionSelect,this.fitSelect,this.zoomOutButton,this.zoomResetButton,this.zoomInButton,spacer,this.counter);

            this.stage = document.createElement('div');
            this.stage.className = 'advancedBooksReaderStage';
            this.pagesElement = document.createElement('div');
            this.pagesElement.className = 'advancedBooksReaderPages';
            this.message = document.createElement('div');
            this.message.className = 'advancedBooksReaderMessage';
            this.stage.append(this.pagesElement, this.message);
            this.overlay.append(toolbar, this.stage);
            document.body.appendChild(this.overlay);
            this.syncControlState();
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
            if (value === 'webtoon') {
                this.fit = 'width';
                this.fitSelect.value = 'width';
            }
            this.resetTransform();
            this.syncControlState();
            this.render();
        }

        syncControlState() {
            const continuous = this.isContinuous();
            this.directionSelect.disabled = continuous;
            this.fitSelect.disabled = this.layout === 'webtoon';
            this.zoomOutButton.disabled = continuous;
            this.zoomResetButton.disabled = continuous;
            this.zoomInButton.disabled = continuous;
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

        previous() { this.goTo(this.currentPage - this.pageStep()); }
        next() { this.goTo(this.currentPage + this.pageStep()); }

        goTo(index) {
            const maximum = Math.max(0, this.pageCount - 1);
            const clamped = Math.min(maximum, Math.max(0, index));
            const aligned = this.alignPage(clamped);
            if (this.isContinuous()) {
                this.currentPage = clamped;
                this.updateControls();
                const element = this.continuousElements[clamped];
                if (element) {
                    this.loadContinuousPage(clamped, element).catch(() => {});
                    this.stage.scrollTo({ top: Math.max(0, element.offsetTop - 4), behavior: 'smooth' });
                }
                return;
            }
            if (aligned === this.currentPage) return;
            this.currentPage = aligned;
            this.resetTransform();
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
            this.resetTransform();
            this.stage.className = 'advancedBooksReaderStage ab-continuous';
            this.pagesElement.className = `advancedBooksReaderPages ab-continuous ab-layout-${this.layout} ab-fit-${this.fit}`;
            this.pagesElement.style.transform = 'none';
            this.pagesElement.replaceChildren();
            this.message.textContent = '';
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
        }

        setZoom(value) {
            if (this.isContinuous()) return;
            this.zoom = Math.min(4, Math.max(.5, Math.round(value * 100) / 100));
            if (this.zoom === 1) { this.panX = 0; this.panY = 0; }
            this.applyTransform();
        }

        resetTransform() { this.zoom = 1; this.panX = 0; this.panY = 0; }

        applyTransform() {
            if (this.isContinuous()) {
                this.pagesElement.className = `advancedBooksReaderPages ab-continuous ab-layout-${this.layout} ab-fit-${this.fit}`;
                this.pagesElement.style.transform = 'none';
                this.stage.style.touchAction = 'pan-y';
                this.zoomResetButton.textContent = '100%';
                return;
            }
            this.pagesElement.className = `advancedBooksReaderPages ab-layout-${this.layout} ab-fit-${this.fit}`;
            this.pagesElement.style.transform = `translate(${this.panX}px,${this.panY}px) scale(${this.zoom})`;
            this.pagesElement.style.cursor = this.zoom > 1 ? 'grab' : 'default';
            this.stage.style.touchAction = this.zoom > 1 ? 'none' : 'pan-y';
            this.zoomResetButton.textContent = `${Math.round(this.zoom * 100)}%`;
        }

        onKeyDown(event) {
            if (!this.overlay?.isConnected) return;
            if (event.key === 'Escape') {
                event.preventDefault(); event.stopPropagation(); this.close(); return;
            }
            if (event.ctrlKey || event.altKey || event.metaKey) return;

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
            else if (event.key === '+' || event.key === '=') { event.preventDefault(); this.setZoom(this.zoom + .25); }
            else if (event.key === '-') { event.preventDefault(); this.setZoom(this.zoom - .25); }
            else if (event.key === '0') { event.preventDefault(); this.setZoom(1); }
        }

        onWheel(event) {
            if (this.isContinuous()) return;
            if (event.ctrlKey || this.zoom > 1) {
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
            if (this.isContinuous()) return;
            this.pointerStart = { id:event.pointerId,x:event.clientX,y:event.clientY,panX:this.panX,panY:this.panY };
            this.stage.setPointerCapture?.(event.pointerId);
            if (this.zoom > 1) this.pagesElement.style.cursor = 'grabbing';
        }

        onPointerMove(event) {
            if (this.isContinuous() || !this.pointerStart || event.pointerId !== this.pointerStart.id || this.zoom <= 1) return;
            event.preventDefault();
            this.panX = this.pointerStart.panX + event.clientX - this.pointerStart.x;
            this.panY = this.pointerStart.panY + event.clientY - this.pointerStart.y;
            this.applyTransform();
            this.pagesElement.style.cursor = 'grabbing';
        }

        onPointerUp(event) {
            if (this.isContinuous() || !this.pointerStart || event.pointerId !== this.pointerStart.id) return;
            const start = this.pointerStart;
            this.pointerStart = null;
            this.stage.releasePointerCapture?.(event.pointerId);
            this.applyTransform();
            if (this.zoom > 1) return;

            const deltaX = event.clientX - start.x;
            const deltaY = event.clientY - start.y;
            if (Math.abs(deltaX) > 55 && Math.abs(deltaX) > Math.abs(deltaY)) {
                const swipeLeft = deltaX < 0;
                if (this.direction === 'rtl') swipeLeft ? this.previous() : this.next();
                else swipeLeft ? this.next() : this.previous();
                return;
            }
            if (Math.abs(deltaX) < 8 && Math.abs(deltaY) < 8) {
                const rect = this.stage.getBoundingClientRect();
                const leftHalf = event.clientX < rect.left + rect.width / 2;
                if (this.direction === 'rtl') leftHalf ? this.next() : this.previous();
                else leftHalf ? this.previous() : this.next();
            }
        }
    }

    document.addEventListener('viewshow', scheduleAttach);
    window.addEventListener('hashchange', scheduleAttach);
    window.addEventListener('popstate', scheduleAttach);
    new MutationObserver(scheduleAttach).observe(document.documentElement, { childList: true, subtree: true });
    scheduleAttach();
}());
