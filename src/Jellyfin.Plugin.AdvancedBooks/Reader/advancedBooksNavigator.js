(function () {
    'use strict';

    if (window.__jellyfinAdvancedBooksNavigatorLoaded) return;
    window.__jellyfinAdvancedBooksNavigatorLoaded = true;

    const thumbnailWidth = 128;
    const thumbnailCacheLimit = 48;
    const thumbnailRequestConcurrency = 3;
    const thumbnailRequestTimeoutMs = 6000;
    const thumbnailRetryLimit = 1;
    const gridOverscanPx = 440;
    const gridFarAbortPx = 1600;
    const gridScrollDebounceMs = 48;
    const gridWatchdogMs = 350;
    let navigatorToken = 0;
    let activeNavigator = null;

    function getApiClient() {
        const apiClient = window.ApiClient;
        return apiClient && typeof apiClient.getUrl === 'function' ? apiClient : null;
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

    function parseCounter(counter) {
        const text = counter?.textContent?.trim() ?? '';
        const match = text.match(/^(\d+)(?:\s*[–-]\s*(\d+))?\s*\/\s*(\d+)/);
        if (!match) return null;
        const first = Number(match[1]);
        const last = Number(match[2] ?? match[1]);
        const count = Number(match[3]);
        if (![first, last, count].every(Number.isFinite) || count <= 0) return null;
        return {
            first: Math.max(0, Math.min(count - 1, first - 1)),
            last: Math.max(0, Math.min(count - 1, last - 1)),
            count
        };
    }

    function waitForCounterPage(counter, wantedPageIndex, timeoutMs = 2500) {
        return new Promise(resolve => {
            const isReady = () => parseCounter(counter)?.last === wantedPageIndex;
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

    async function getMetadata(apiClient, itemId) {
        if (!apiClient || typeof apiClient.ajax !== 'function') return null;
        const raw = await apiClient.ajax({
            type: 'GET',
            dataType: 'json',
            url: apiClient.getUrl(`AdvancedBooks/Books/${encodeURIComponent(itemId)}/Pages`)
        });
        const pages = raw?.Pages ?? raw?.pages ?? [];
        return Array.isArray(pages) ? pages : [];
    }

    function ensureStyles() {
        if (document.getElementById('advancedBooksNavigatorStyles')) return;
        const style = document.createElement('style');
        style.id = 'advancedBooksNavigatorStyles';
        style.textContent = `
            .advancedBooksNavigatorButton{white-space:nowrap}
            .advancedBooksNavigatorPanel{position:absolute;z-index:20;top:0;right:0;bottom:0;width:min(28rem,92vw);display:flex;flex-direction:column;background:#111;color:#fff;box-shadow:-8px 0 32px rgba(0,0,0,.55);border-left:1px solid rgba(255,255,255,.12)}
            .advancedBooksNavigatorHeader{display:flex;align-items:center;gap:.5rem;min-height:3.5rem;padding:.55rem .75rem;border-bottom:1px solid rgba(255,255,255,.12);background:#181818;box-sizing:border-box}
            .advancedBooksNavigatorHeader strong{font-size:1.05rem}.advancedBooksNavigatorHeader span{opacity:.65;font-variant-numeric:tabular-nums}.advancedBooksNavigatorHeader button{margin-left:auto;inline-size:2.75rem;block-size:2.75rem;min-width:2.75rem;min-height:2.75rem;padding:0;border:1px solid rgba(255,255,255,.18);border-radius:999px;background:#282828;color:#fff;font:inherit}
            .advancedBooksNavigatorGrid{position:relative;flex:1 1 auto;min-height:0;overflow:auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(7.25rem,1fr));align-content:start;gap:.65rem;padding:.75rem;overscroll-behavior:contain;scrollbar-gutter:stable}
            .advancedBooksNavigatorCard{appearance:none;display:flex;flex-direction:column;gap:.35rem;min-width:0;padding:.35rem;border:2px solid transparent;border-radius:.45rem;background:#1c1c1c;color:#fff;text-align:center;font:inherit;cursor:pointer;transition:border-color .12s ease,background .12s ease;contain:layout paint style}
            .advancedBooksNavigatorCard:hover,.advancedBooksNavigatorCard:focus-visible{background:#292929;outline:none;border-color:rgba(255,255,255,.42)}
            .advancedBooksNavigatorCard.ab-current{border-color:#00a4dc;background:#17313b}
            .advancedBooksNavigatorThumb{position:relative;width:100%;aspect-ratio:2/3;display:flex;align-items:center;justify-content:center;overflow:hidden;border-radius:.25rem;background:#090909;color:rgba(255,255,255,.45);font-size:.8rem}
            .advancedBooksNavigatorThumb img{position:absolute;inset:0;display:block;width:100%;height:100%;object-fit:contain;background:#090909}
            .advancedBooksNavigatorThumbStatus{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:.4rem;text-align:center;line-height:1.25;box-sizing:border-box;pointer-events:none}
            .advancedBooksNavigatorThumbStatus[hidden]{display:none!important}
            .advancedBooksNavigatorCard.ab-loading .advancedBooksNavigatorThumbStatus::before{content:"";inline-size:1.05rem;block-size:1.05rem;border:2px solid rgba(255,255,255,.2);border-top-color:rgba(255,255,255,.8);border-radius:50%;animation:advancedBooksNavigatorSpin .7s linear infinite}
            .advancedBooksNavigatorCard.ab-loading .advancedBooksNavigatorThumbStatus{font-size:0}
            .advancedBooksNavigatorCard.ab-failed .advancedBooksNavigatorThumbStatus{font-size:.72rem;color:rgba(255,255,255,.62)}
            .advancedBooksNavigatorLabel{font-size:.85rem;font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
            @keyframes advancedBooksNavigatorSpin{to{transform:rotate(360deg)}}
            @media(max-width:700px){.advancedBooksNavigatorPanel{width:100%;border-left:0}.advancedBooksNavigatorGrid{grid-template-columns:repeat(auto-fill,minmax(6.25rem,1fr));gap:.45rem;padding:.5rem}.advancedBooksNavigatorHeader button{inline-size:2.75rem;block-size:2.75rem}}
            @media(prefers-reduced-motion:reduce){.advancedBooksNavigatorCard{transition:none}.advancedBooksNavigatorCard.ab-loading .advancedBooksNavigatorThumbStatus::before{animation:none}}
        `;
        document.head.appendChild(style);
    }

    class PageNavigator {
        constructor(apiClient, itemId, overlay, pages) {
            this.apiClient = apiClient;
            this.itemId = itemId;
            this.overlay = overlay;
            this.pages = pages;
            this.counter = overlay.querySelector('.advancedBooksReaderCounter');
            this.button = null;
            this.panel = null;
            this.grid = null;
            this.cards = [];
            this.cache = new Map();
            this.pending = new Map();
            this.queue = [];
            this.queued = new Set();
            this.attempts = new Map();
            this.activeRequests = 0;
            this.requestSequence = 0;
            this.counterObserver = null;
            this.removalObserver = null;
            this.scrollTimer = null;
            this.watchdogTimer = null;
            this.panelGeneration = 0;
            this.closed = false;
            this.boundGridScroll = () => this.scheduleGridRefresh();
        }

        attach() {
            if (this.closed || !this.counter || this.pages.length === 0) return;
            ensureStyles();
            const toolbar = this.overlay.querySelector('.advancedBooksReaderToolbar');
            const buttonHost = this.overlay.querySelector('[data-ab-pages-host="true"]') ?? toolbar;
            if (!buttonHost || this.overlay.querySelector('.advancedBooksNavigatorButton')) return;

            this.button = document.createElement('button');
            this.button.type = 'button';
            this.button.className = 'advancedBooksNavigatorButton advancedBooksReaderIconButton';
            this.button.textContent = '▦';
            this.button.title = 'Pages';
            this.button.setAttribute('aria-label', 'Open page navigator');
            this.button.addEventListener('click', event => {
                event.preventDefault();
                event.stopPropagation();
                this.toggle();
            });

            buttonHost.appendChild(this.button);

            this.counterObserver = new MutationObserver(() => this.updateCurrent());
            this.counterObserver.observe(this.counter, { childList: true, characterData: true, subtree: true });

            this.removalObserver = new MutationObserver(() => {
                if (!this.overlay.isConnected) this.dispose();
            });
            this.removalObserver.observe(document.body, { childList: true, subtree: true });
        }

        toggle() {
            if (this.panel?.isConnected) this.closePanel();
            else this.openPanel();
        }

        openPanel() {
            if (this.closed || this.panel?.isConnected) return;
            this.panelGeneration++;
            this.panel = document.createElement('section');
            this.panel.className = 'advancedBooksNavigatorPanel';
            this.panel.setAttribute('role', 'dialog');
            this.panel.setAttribute('aria-label', 'Page navigator');

            const header = document.createElement('div');
            header.className = 'advancedBooksNavigatorHeader';
            const title = document.createElement('strong');
            title.textContent = 'Pages';
            const count = document.createElement('span');
            count.textContent = `${this.pages.length} pages`;
            const close = document.createElement('button');
            close.type = 'button';
            close.textContent = '×';
            close.title = 'Close page navigator';
            close.setAttribute('aria-label', 'Close page navigator');
            close.addEventListener('click', () => this.closePanel());
            header.append(title, count, close);

            this.grid = document.createElement('div');
            this.grid.className = 'advancedBooksNavigatorGrid';
            this.cards = this.pages.map((page, index) => this.createCard(page, index));
            this.grid.append(...this.cards);
            this.panel.append(header, this.grid);
            this.overlay.appendChild(this.panel);
            this.grid.addEventListener('scroll', this.boundGridScroll, { passive: true });

            this.updateCurrent(true);
            requestAnimationFrame(() => {
                this.refreshGridWindow(true);
                this.focusCurrentCard();
                this.refreshGridWindow(true);
            });
            this.scheduleWatchdog();
        }

        closePanel() {
            this.panelGeneration++;
            window.clearTimeout(this.scrollTimer);
            window.clearTimeout(this.watchdogTimer);
            this.grid?.removeEventListener('scroll', this.boundGridScroll);
            this.queue = [];
            this.queued.clear();
            for (const index of Array.from(this.pending.keys())) this.abortRequest(index);
            this.panel?.remove();
            this.panel = null;
            this.grid = null;
            this.cards = [];
            this.activeRequests = 0;
            this.trimCache(this.currentPageIndex(), true);
            this.button?.focus?.();
        }

        createCard(page, index) {
            const card = document.createElement('button');
            card.type = 'button';
            card.className = 'advancedBooksNavigatorCard';
            card.dataset.pageIndex = String(index);
            card.dataset.thumbnailState = 'idle';
            card.title = page?.Name ?? page?.name ?? `Page ${index + 1}`;

            const thumb = document.createElement('div');
            thumb.className = 'advancedBooksNavigatorThumb';
            const status = document.createElement('span');
            status.className = 'advancedBooksNavigatorThumbStatus';
            status.textContent = `Page ${index + 1}`;
            thumb.appendChild(status);

            const label = document.createElement('span');
            label.className = 'advancedBooksNavigatorLabel';
            label.textContent = `${index + 1}`;
            card.append(thumb, label);
            card.addEventListener('click', async () => {
                this.closePanel();
                await this.jumpToPage(index);
            });
            return card;
        }

        currentPageIndex() {
            return parseCounter(this.counter)?.last ?? 0;
        }

        updateCurrent(scrollIfNeeded) {
            if (!this.cards.length) return;
            const current = parseCounter(this.counter);
            if (!current) return;
            this.cards.forEach((card, index) => {
                const active = index >= current.first && index <= current.last;
                card.classList.toggle('ab-current', active);
                if (active) card.setAttribute('aria-current', 'page');
                else card.removeAttribute('aria-current');
            });
            this.trimCache(current.last, false);
            if (scrollIfNeeded) this.focusCurrentCard(false);
        }

        focusCurrentCard(focus = true) {
            const current = this.currentPageIndex();
            const card = this.cards[current];
            if (!card) return;
            card.scrollIntoView({ block: 'center', inline: 'nearest' });
            if (focus) card.focus({ preventScroll: true });
        }

        scheduleGridRefresh() {
            window.clearTimeout(this.scrollTimer);
            this.scrollTimer = window.setTimeout(() => this.refreshGridWindow(true), gridScrollDebounceMs);
        }

        scheduleWatchdog() {
            window.clearTimeout(this.watchdogTimer);
            if (this.closed || !this.panel?.isConnected) return;
            this.watchdogTimer = window.setTimeout(() => {
                this.refreshGridWindow(false);
                this.scheduleWatchdog();
            }, gridWatchdogMs);
        }

        getWindow() {
            if (!this.grid?.isConnected) return null;
            const visibleTop = this.grid.scrollTop;
            const visibleBottom = visibleTop + this.grid.clientHeight;
            return {
                visibleTop,
                visibleBottom,
                wantedTop: Math.max(0, visibleTop - gridOverscanPx),
                wantedBottom: visibleBottom + gridOverscanPx,
                center: (visibleTop + visibleBottom) / 2
            };
        }

        isVisible(index) {
            const windowInfo = this.getWindow();
            const card = this.cards[index];
            if (!windowInfo || !card?.isConnected) return false;
            const top = card.offsetTop;
            const bottom = top + card.offsetHeight;
            return bottom >= windowInfo.visibleTop && top <= windowInfo.visibleBottom;
        }

        refreshGridWindow(cancelFar) {
            const windowInfo = this.getWindow();
            if (this.closed || !windowInfo || !this.cards.length) return;

            const candidates = [];
            const wanted = new Set();
            for (let index = 0; index < this.cards.length; index++) {
                const card = this.cards[index];
                const top = card.offsetTop;
                const bottom = top + card.offsetHeight;
                if (bottom < windowInfo.wantedTop || top > windowInfo.wantedBottom) continue;
                const visible = bottom >= windowInfo.visibleTop && top <= windowInfo.visibleBottom;
                wanted.add(index);
                candidates.push({
                    index,
                    visible,
                    priority: (visible ? -100000 : 0) + Math.abs(((top + bottom) / 2) - windowInfo.center)
                });
            }

            candidates.sort((a, b) => a.priority - b.priority);
            this.queue = this.queue.filter(item => wanted.has(item.index));
            this.queued = new Set(this.queue.map(item => item.index));

            for (const candidate of candidates) {
                this.queueThumbnail(candidate.index, candidate.priority, candidate.visible);
            }

            if (cancelFar) this.abortFarRequests(windowInfo.visibleTop, windowInfo.visibleBottom);
            this.pumpThumbnailQueue();
        }

        abortFarRequests(visibleTop, visibleBottom) {
            for (const [index] of this.pending) {
                const card = this.cards[index];
                if (!card?.isConnected) {
                    this.abortRequest(index);
                    continue;
                }
                const top = card.offsetTop;
                const bottom = top + card.offsetHeight;
                if (bottom < visibleTop - gridFarAbortPx || top > visibleBottom + gridFarAbortPx) {
                    this.abortRequest(index);
                }
            }
        }

        abortRequest(index, reason = 'scroll') {
            const pending = this.pending.get(index);
            if (!pending) return;
            this.pending.delete(index);
            this.activeRequests = Math.max(0, this.activeRequests - 1);
            pending.aborted = true;
            pending.abortReason = reason;
            pending.controller.abort();
            const card = this.cards[index];
            if (card?.dataset.thumbnailState === 'loading') this.setCardState(index, 'idle');

            if (reason === 'timeout') {
                const attempts = (this.attempts.get(index) ?? 0) + 1;
                this.attempts.set(index, attempts);
                if (this.isVisible(index)) {
                    if (attempts < thumbnailRetryLimit) {
                        window.setTimeout(() => this.queueThumbnail(index, -100000, true), 80);
                    } else {
                        this.startFullPageFallback(index, this.panelGeneration).catch(() => {
                            this.setCardState(index, 'failed', 'Preview unavailable');
                        });
                    }
                }
            }

            this.pumpThumbnailQueue();
        }

        queueThumbnail(index, priority = 0, visible = false) {
            if (this.closed || !this.panel?.isConnected || index < 0 || index >= this.pages.length) return;

            const cached = this.cache.get(index);
            if (cached) {
                this.applyThumbnail(index, cached);
                return;
            }

            const pending = this.pending.get(index);
            if (pending) {
                if (visible) pending.visible = true;
                return;
            }

            const attempts = this.attempts.get(index) ?? 0;
            if (attempts >= thumbnailRetryLimit && !visible) return;

            const queued = this.queue.find(item => item.index === index);
            if (queued) {
                queued.priority = Math.min(queued.priority, priority);
                queued.visible ||= visible;
                this.queue.sort((a, b) => a.priority - b.priority);
                return;
            }

            this.queue.push({ index, priority, visible });
            this.queue.sort((a, b) => a.priority - b.priority);
            this.queued.add(index);
            this.pumpThumbnailQueue();
        }

        pumpThumbnailQueue() {
            if (this.closed || !this.panel?.isConnected) return;
            while (this.activeRequests < thumbnailRequestConcurrency && this.queue.length > 0) {
                const next = this.queue.shift();
                if (!next) break;
                this.queued.delete(next.index);
                if (this.cache.has(next.index) || this.pending.has(next.index)) continue;
                this.startThumbnailRequest(next);
            }
        }

        startThumbnailRequest(item) {
            const requestId = ++this.requestSequence;
            const generation = this.panelGeneration;
            const controller = new AbortController();
            const pending = {
                id: requestId,
                generation,
                controller,
                aborted: false,
                visible: item.visible,
                timeout: null
            };

            this.pending.set(item.index, pending);
            this.activeRequests++;
            this.setCardState(item.index, 'loading');

            pending.timeout = window.setTimeout(() => {
                const current = this.pending.get(item.index);
                if (current?.id === requestId) this.abortRequest(item.index, 'timeout');
            }, thumbnailRequestTimeoutMs);

            this.fetchThumbnail(item.index, controller.signal, generation)
                .then(objectUrl => {
                    if (!objectUrl) return;
                    this.attempts.delete(item.index);
                    this.applyThumbnail(item.index, objectUrl);
                })
                .catch(error => {
                    if (error?.name === 'AbortError' || pending.aborted) return;
                    const attempts = (this.attempts.get(item.index) ?? 0) + 1;
                    this.attempts.set(item.index, attempts);
                    if (this.isVisible(item.index)) {
                        if (attempts < thumbnailRetryLimit) {
                            window.setTimeout(() => this.queueThumbnail(item.index, -100000, true), 120);
                        } else {
                            this.startFullPageFallback(item.index, generation).catch(() => {
                                this.setCardState(item.index, 'failed', 'Preview unavailable');
                            });
                        }
                    } else {
                        this.setCardState(item.index, 'idle');
                    }
                })
                .finally(() => {
                    window.clearTimeout(pending.timeout);
                    const current = this.pending.get(item.index);
                    if (current?.id === requestId) {
                        this.pending.delete(item.index);
                        this.activeRequests = Math.max(0, this.activeRequests - 1);
                    }
                    this.pumpThumbnailQueue();
                });
        }

        async fetchThumbnail(index, signal, generation) {
            const url = this.apiClient.getUrl(
                `AdvancedBooks/Books/${encodeURIComponent(this.itemId)}/Pages/${index}/Thumbnail?width=${thumbnailWidth}`
            );
            const response = await this.apiClient.fetch({ url, method: 'GET', signal }, true);
            if (!response || response.ok === false) throw new Error(`HTTP ${response?.status ?? 'error'}`);
            const blob = await response.blob();
            if (this.closed || !this.panel?.isConnected || signal.aborted || generation !== this.panelGeneration) return null;

            const objectUrl = URL.createObjectURL(blob);
            const existing = this.cache.get(index);
            if (existing) URL.revokeObjectURL(existing);
            this.cache.delete(index);
            this.cache.set(index, objectUrl);
            this.trimCache(this.currentPageIndex(), false);
            return objectUrl;
        }

        async startFullPageFallback(index, generation) {
            if (!this.isVisible(index) || generation !== this.panelGeneration || this.cache.has(index)) return;
            this.setCardState(index, 'loading');
            const url = this.apiClient.getUrl(
                `AdvancedBooks/Books/${encodeURIComponent(this.itemId)}/Pages/${index}`
            );
            const response = await this.apiClient.fetch({ url, method: 'GET' }, true);
            if (!response || response.ok === false) throw new Error(`HTTP ${response?.status ?? 'error'}`);
            const blob = await response.blob();
            if (this.closed || generation !== this.panelGeneration || !this.panel?.isConnected) return;

            const objectUrl = URL.createObjectURL(blob);
            const existing = this.cache.get(index);
            if (existing) URL.revokeObjectURL(existing);
            this.cache.delete(index);
            this.cache.set(index, objectUrl);
            this.trimCache(this.currentPageIndex(), false);
            this.applyThumbnail(index, objectUrl);
        }

        setCardState(index, state, message) {
            const card = this.cards[index];
            if (!card?.isConnected) return;
            card.dataset.thumbnailState = state;
            card.classList.toggle('ab-loading', state === 'loading');
            card.classList.toggle('ab-failed', state === 'failed');
            const status = card.querySelector('.advancedBooksNavigatorThumbStatus');
            if (!status) return;
            if (state === 'loaded') {
                status.hidden = true;
            } else {
                status.hidden = false;
                status.textContent = message ?? (state === 'failed' ? 'Preview unavailable' : `Page ${index + 1}`);
            }
        }

        applyThumbnail(index, objectUrl) {
            const card = this.cards[index];
            if (!card?.isConnected) return;
            const thumb = card.querySelector('.advancedBooksNavigatorThumb');
            if (!thumb) return;

            let image = thumb.querySelector('img');
            if (!image) {
                image = document.createElement('img');
                image.alt = `Page ${index + 1}`;
                image.decoding = 'async';
                image.draggable = false;
                thumb.appendChild(image);
            }
            image.src = objectUrl;
            this.setCardState(index, 'loaded');
        }

        trimCache(current, aggressive) {
            const limit = aggressive ? 12 : thumbnailCacheLimit;
            if (this.cache.size <= limit) return;
            const protectedIndexes = new Set();
            for (let index = Math.max(0, current - 8); index <= Math.min(this.pages.length - 1, current + 8); index++) {
                protectedIndexes.add(index);
            }
            for (let index = 0; index < this.cards.length; index++) {
                if (this.isVisible(index)) protectedIndexes.add(index);
            }

            const candidates = Array.from(this.cache.keys())
                .filter(index => !protectedIndexes.has(index))
                .sort((a, b) => Math.abs(b - current) - Math.abs(a - current));
            while (this.cache.size > limit && candidates.length) this.evict(candidates.shift());
        }

        evict(index) {
            const objectUrl = this.cache.get(index);
            if (!objectUrl) return;
            URL.revokeObjectURL(objectUrl);
            this.cache.delete(index);
            const card = this.cards[index];
            const image = card?.querySelector('.advancedBooksNavigatorThumb img');
            image?.remove();
            if (card) this.setCardState(index, 'idle');
        }

        async jumpToPage(index) {
            if (!this.overlay?.isConnected || index < 0 || index >= this.pages.length) return;
            const reader = this.overlay.__advancedBooksReaderSession;
            if (reader && typeof reader.goTo === 'function') {
                reader.goTo(index, 'auto');
                return;
            }

            const layoutSelect = this.overlay.querySelector('[data-ab-control="layout"]')
                ?? this.overlay.querySelector('.advancedBooksReaderToolbar select');
            if (!layoutSelect) return;
            const originalLayout = layoutSelect.value || 'single';

            if (originalLayout !== 'vertical') {
                layoutSelect.value = 'vertical';
                layoutSelect.dispatchEvent(new Event('change', { bubbles: true }));
            }

            const slot = await waitFor(
                `.advancedBooksReaderPageSlot[data-page-index="${index}"]`,
                this.overlay,
                3500
            );
            if (!slot || !this.overlay.isConnected) return;

            const stage = this.overlay.querySelector('.advancedBooksReaderStage');
            if (stage) stage.scrollTop = Math.max(0, slot.offsetTop - 4);
            else slot.scrollIntoView({ block: 'start' });

            await waitForCounterPage(this.counter, index);
            if (originalLayout !== 'vertical' && this.overlay.isConnected) {
                layoutSelect.value = originalLayout;
                layoutSelect.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }

        dispose() {
            if (this.closed) return;
            this.closed = true;
            this.panelGeneration++;
            window.clearTimeout(this.scrollTimer);
            window.clearTimeout(this.watchdogTimer);
            this.grid?.removeEventListener('scroll', this.boundGridScroll);
            this.counterObserver?.disconnect();
            this.removalObserver?.disconnect();
            this.queue = [];
            this.queued.clear();
            for (const index of Array.from(this.pending.keys())) this.abortRequest(index);
            for (const objectUrl of this.cache.values()) URL.revokeObjectURL(objectUrl);
            this.cache.clear();
            this.panel?.remove();
            this.button?.remove();
            if (activeNavigator === this) activeNavigator = null;
        }
    }

    async function attachNavigator(itemId, token) {
        const apiClient = getApiClient();
        if (!apiClient) return;
        const metadataPromise = getMetadata(apiClient, itemId).catch(() => null);
        const overlay = await waitFor('.advancedBooksReaderOverlay', document, 4000);
        if (!overlay || token !== navigatorToken) return;
        const pages = await metadataPromise;
        if (!pages?.length || token !== navigatorToken || !overlay.isConnected) return;

        activeNavigator?.dispose();
        activeNavigator = new PageNavigator(apiClient, itemId, overlay, pages);
        activeNavigator.attach();
    }

    document.addEventListener('click', event => {
        const readerButton = event.target?.closest?.('.advancedBooksReaderButton');
        if (!readerButton) return;
        const itemId = readerButton.dataset.advancedBooksItemId;
        if (!itemId) return;
        const token = ++navigatorToken;
        attachNavigator(itemId, token).catch(() => {});
    }, true);
}());
