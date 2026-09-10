(function () {
    'use strict';

    if (window.__jellyfinAdvancedBooksNavigatorLoaded) return;
    window.__jellyfinAdvancedBooksNavigatorLoaded = true;

    const thumbnailWidth = 180;
    const thumbnailCacheLimit = 48;
    const thumbnailRequestConcurrency = 3;
    const gridOverscanPx = 520;
    const gridFarAbortPx = 1800;
    const gridScrollDebounceMs = 48;
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
            .advancedBooksNavigatorGrid{flex:1 1 auto;min-height:0;overflow:auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(7.25rem,1fr));align-content:start;gap:.65rem;padding:.75rem;overscroll-behavior:contain;scrollbar-gutter:stable}
            .advancedBooksNavigatorCard{appearance:none;display:flex;flex-direction:column;gap:.35rem;min-width:0;padding:.35rem;border:2px solid transparent;border-radius:.45rem;background:#1c1c1c;color:#fff;text-align:center;font:inherit;cursor:pointer;transition:border-color .12s ease,background .12s ease;contain:layout paint style}
            .advancedBooksNavigatorCard:hover,.advancedBooksNavigatorCard:focus-visible{background:#292929;outline:none;border-color:rgba(255,255,255,.42)}
            .advancedBooksNavigatorCard.ab-current{border-color:#00a4dc;background:#17313b}
            .advancedBooksNavigatorThumb{position:relative;width:100%;aspect-ratio:2/3;display:flex;align-items:center;justify-content:center;overflow:hidden;border-radius:.25rem;background:#090909;color:rgba(255,255,255,.38);font-size:.8rem}
            .advancedBooksNavigatorThumb img{display:block;width:100%;height:100%;object-fit:contain;background:#090909}
            .advancedBooksNavigatorLabel{font-size:.85rem;font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
            @media(max-width:700px){.advancedBooksNavigatorPanel{width:100%;border-left:0}.advancedBooksNavigatorGrid{grid-template-columns:repeat(auto-fill,minmax(6.25rem,1fr));gap:.45rem;padding:.5rem}.advancedBooksNavigatorHeader button{inline-size:2.75rem;block-size:2.75rem}}
            @media(prefers-reduced-motion:reduce){.advancedBooksNavigatorCard{transition:none}}
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
            this.activeRequests = 0;
            this.intersectionObserver = null;
            this.counterObserver = null;
            this.removalObserver = null;
            this.scrollTimer = null;
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

            this.intersectionObserver = new IntersectionObserver(entries => {
                const gridRect = this.grid?.getBoundingClientRect();
                const center = gridRect ? (gridRect.top + gridRect.bottom) / 2 : 0;
                for (const entry of entries) {
                    if (!entry.isIntersecting) continue;
                    const index = Number(entry.target.dataset.pageIndex);
                    if (!Number.isInteger(index)) continue;
                    const rect = entry.target.getBoundingClientRect();
                    this.queueThumbnail(index, Math.abs(((rect.top + rect.bottom) / 2) - center));
                }
            }, { root: this.grid, rootMargin: '320px 0px', threshold: 0.01 });

            for (const card of this.cards) this.intersectionObserver.observe(card);

            this.updateCurrent(true);
            requestAnimationFrame(() => {
                this.refreshGridWindow(true);
                this.focusCurrentCard();
            });
        }

        closePanel() {
            window.clearTimeout(this.scrollTimer);
            this.grid?.removeEventListener('scroll', this.boundGridScroll);
            this.intersectionObserver?.disconnect();
            this.intersectionObserver = null;
            this.queue = [];
            this.queued.clear();
            for (const pending of this.pending.values()) pending.controller.abort();
            this.pending.clear();
            this.activeRequests = 0;
            this.panel?.remove();
            this.panel = null;
            this.grid = null;
            this.cards = [];
            this.trimCache(this.currentPageIndex(), true);
            this.button?.focus?.();
        }

        createCard(page, index) {
            const card = document.createElement('button');
            card.type = 'button';
            card.className = 'advancedBooksNavigatorCard';
            card.dataset.pageIndex = String(index);
            card.title = page?.Name ?? page?.name ?? `Page ${index + 1}`;

            const thumb = document.createElement('div');
            thumb.className = 'advancedBooksNavigatorThumb';
            thumb.textContent = `Page ${index + 1}`;
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
            this.scrollTimer = window.setTimeout(() => this.refreshGridWindow(false), gridScrollDebounceMs);
        }

        refreshGridWindow(cancelFar) {
            if (this.closed || !this.grid?.isConnected || !this.cards.length) return;

            const gridRect = this.grid.getBoundingClientRect();
            const wantedTop = gridRect.top - gridOverscanPx;
            const wantedBottom = gridRect.bottom + gridOverscanPx;
            const center = (gridRect.top + gridRect.bottom) / 2;
            const wanted = new Set();
            const candidates = [];

            for (let index = 0; index < this.cards.length; index++) {
                const card = this.cards[index];
                const rect = card.getBoundingClientRect();
                if (rect.bottom < wantedTop || rect.top > wantedBottom) continue;
                wanted.add(index);
                candidates.push({
                    index,
                    priority: Math.abs(((rect.top + rect.bottom) / 2) - center)
                });
            }

            candidates.sort((a, b) => a.priority - b.priority);
            this.queue = this.queue.filter(item => wanted.has(item.index));
            this.queued = new Set(this.queue.map(item => item.index));

            for (const candidate of candidates) {
                this.queueThumbnail(candidate.index, candidate.priority);
            }

            if (cancelFar) {
                this.abortFarRequests(gridRect);
            } else {
                // Also abort requests which became very far from the visible window after a fast fling.
                this.abortFarRequests(gridRect);
            }

            this.pumpThumbnailQueue();
        }

        abortFarRequests(gridRect) {
            for (const [index, pending] of this.pending) {
                const card = this.cards[index];
                if (!card?.isConnected) {
                    pending.controller.abort();
                    continue;
                }
                const rect = card.getBoundingClientRect();
                if (rect.bottom < gridRect.top - gridFarAbortPx || rect.top > gridRect.bottom + gridFarAbortPx) {
                    pending.controller.abort();
                }
            }
        }

        queueThumbnail(index, priority = 0) {
            if (this.closed || !this.panel?.isConnected || index < 0 || index >= this.pages.length) return;
            const cached = this.cache.get(index);
            if (cached) {
                this.applyThumbnail(index, cached);
                return;
            }
            if (this.pending.has(index) || this.queued.has(index)) return;

            this.queue.push({ index, priority });
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

                const controller = new AbortController();
                this.activeRequests++;
                const promise = this.fetchThumbnail(next.index, controller.signal)
                    .catch(() => {
                        // Keep the grid usable if one preview fails.
                    })
                    .finally(() => {
                        this.pending.delete(next.index);
                        this.activeRequests = Math.max(0, this.activeRequests - 1);
                        this.pumpThumbnailQueue();
                    });
                this.pending.set(next.index, { controller, promise });
            }
        }

        async fetchThumbnail(index, signal) {
            const url = this.apiClient.getUrl(
                `AdvancedBooks/Books/${encodeURIComponent(this.itemId)}/Pages/${index}/Thumbnail?width=${thumbnailWidth}`
            );
            const response = await this.apiClient.fetch({ url, method: 'GET', signal }, true);
            if (!response || response.ok === false) throw new Error(`HTTP ${response?.status ?? 'error'}`);
            const blob = await response.blob();
            if (this.closed || !this.panel?.isConnected || signal.aborted) return;

            const objectUrl = URL.createObjectURL(blob);
            const existing = this.cache.get(index);
            if (existing) URL.revokeObjectURL(existing);
            this.cache.delete(index);
            this.cache.set(index, objectUrl);
            this.applyThumbnail(index, objectUrl);
            this.trimCache(this.currentPageIndex(), false);
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
                image.loading = 'lazy';
                image.decoding = 'async';
                image.draggable = false;
                thumb.textContent = '';
                thumb.appendChild(image);
            }
            if (image.src !== objectUrl) image.src = objectUrl;
        }

        trimCache(current, aggressive) {
            const limit = aggressive ? 12 : thumbnailCacheLimit;
            if (this.cache.size <= limit) return;
            const protectedIndexes = new Set();
            for (let index = Math.max(0, current - 8); index <= Math.min(this.pages.length - 1, current + 8); index++) {
                protectedIndexes.add(index);
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
            const thumb = card?.querySelector('.advancedBooksNavigatorThumb');
            if (thumb) {
                thumb.querySelector('img')?.remove();
                if (!thumb.textContent) thumb.textContent = `Page ${index + 1}`;
            }
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
            window.clearTimeout(this.scrollTimer);
            this.grid?.removeEventListener('scroll', this.boundGridScroll);
            this.intersectionObserver?.disconnect();
            this.counterObserver?.disconnect();
            this.removalObserver?.disconnect();
            this.queue = [];
            this.queued.clear();
            for (const pending of this.pending.values()) pending.controller.abort();
            this.pending.clear();
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
