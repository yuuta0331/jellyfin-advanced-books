(function () {
    'use strict';

    if (window.__jellyfinAdvancedBooksGesturesLoaded) return;
    window.__jellyfinAdvancedBooksGesturesLoaded = true;

    const minimumZoom = 0.5;
    const maximumZoom = 4;
    const minimumPinchDistance = 24;
    const minimumCommittedZoomDelta = 0.025;
    const doubleTapDelayMs = 280;
    const doubleTapDistance = 42;
    const tapMovementTolerance = 12;
    const tapMaximumDurationMs = 360;
    const doubleTapZoom = 2;
    const navigationZoneEdge = 0.32;
    const mouseDragThreshold = 6;
    const pageMotionDurationMs = 220;
    let activeSession = null;

    function clampZoom(value) {
        if (!Number.isFinite(value)) return 1;
        return Math.min(maximumZoom, Math.max(minimumZoom, value));
    }

    function currentZoom(overlay) {
        const reader = overlay.__advancedBooksReaderSession;
        if (reader && Number.isFinite(reader.zoom)) return clampZoom(reader.zoom);

        const reset = overlay.querySelector('.advancedBooksReaderToolbar button[data-ab-action="zoom-reset"],button[title="Reset zoom"]');
        const text = reset?.textContent?.trim() ?? '100%';
        const percent = Number.parseInt(text.replace('%', ''), 10);
        return Number.isFinite(percent) ? clampZoom(percent / 100) : 1;
    }

    function midpoint(first, second) {
        return {
            x: (first.x + second.x) / 2,
            y: (first.y + second.y) / 2
        };
    }

    function distance(first, second) {
        return Math.hypot(second.x - first.x, second.y - first.y);
    }

    function ensureInteractionStyles() {
        if (document.getElementById('advancedBooksReaderGestureStyles')) return;
        const style = document.createElement('style');
        style.id = 'advancedBooksReaderGestureStyles';
        style.textContent = `
.advancedBooksReaderOverlay.ab-animate-transitions .advancedBooksReaderPages:not(.ab-continuous) img{backface-visibility:hidden}
@media (pointer:fine){
    .advancedBooksReaderStage.ab-grab-scroll,.advancedBooksReaderPages.ab-grab-page{cursor:grab}
    .advancedBooksReaderStage.ab-grab-scroll.ab-grabbing,.advancedBooksReaderPages.ab-grab-page.ab-grabbing{cursor:grabbing}
}
.advancedBooksReaderOverlay.ab-animate-transitions .advancedBooksReaderPages:not(.ab-continuous)[data-ab-page-motion="left"] img{animation:advancedBooksPageFromLeft .16s cubic-bezier(.2,.75,.25,1) both}
.advancedBooksReaderOverlay.ab-animate-transitions .advancedBooksReaderPages:not(.ab-continuous)[data-ab-page-motion="right"] img{animation:advancedBooksPageFromRight .16s cubic-bezier(.2,.75,.25,1) both}
@keyframes advancedBooksPageFromLeft{from{transform:translate3d(-10px,0,0)}to{transform:translate3d(0,0,0)}}
@keyframes advancedBooksPageFromRight{from{transform:translate3d(10px,0,0)}to{transform:translate3d(0,0,0)}}
@media(prefers-reduced-motion:reduce){
    .advancedBooksReaderOverlay.ab-animate-transitions .advancedBooksReaderPages:not(.ab-continuous)[data-ab-page-motion] img{animation:none!important}
}
`;
        document.head.appendChild(style);
    }

    function normalizeAnchor(stage, anchor) {
        const rect = stage.getBoundingClientRect();
        const clientX = Number.isFinite(anchor?.clientX) ? anchor.clientX : rect.left + rect.width / 2;
        const clientY = Number.isFinite(anchor?.clientY) ? anchor.clientY : rect.top + rect.height / 2;
        return {
            clientX,
            clientY,
            localX: clientX - rect.left,
            localY: clientY - rect.top,
            centerX: rect.width / 2,
            centerY: rect.height / 2
        };
    }

    function pagedContentBounds(pages) {
        const images = Array.from(pages?.querySelectorAll('img') ?? [])
            .filter(image => image.offsetWidth > 0 && image.offsetHeight > 0);
        if (!images.length) return null;

        let left = Number.POSITIVE_INFINITY;
        let top = Number.POSITIVE_INFINITY;
        let right = Number.NEGATIVE_INFINITY;
        let bottom = Number.NEGATIVE_INFINITY;
        for (const image of images) {
            left = Math.min(left, image.offsetLeft);
            top = Math.min(top, image.offsetTop);
            right = Math.max(right, image.offsetLeft + image.offsetWidth);
            bottom = Math.max(bottom, image.offsetTop + image.offsetHeight);
        }
        return { left, top, right, bottom };
    }

    function clampPagedPan(reader, stage, pages) {
        if (!reader || reader.isContinuous?.()) return;
        const zoom = Number.isFinite(reader.zoom) ? reader.zoom : 1;
        if (zoom <= 1) {
            reader.panX = 0;
            reader.panY = 0;
            return;
        }

        const bounds = pagedContentBounds(pages);
        if (!bounds) return;
        const pageWidth = Math.max(1, pages.clientWidth);
        const pageHeight = Math.max(1, pages.clientHeight);
        const viewportWidth = Math.max(1, stage.clientWidth);
        const viewportHeight = Math.max(1, stage.clientHeight);

        const left = (bounds.left - pageWidth / 2) * zoom;
        const right = (bounds.right - pageWidth / 2) * zoom;
        const top = (bounds.top - pageHeight / 2) * zoom;
        const bottom = (bounds.bottom - pageHeight / 2) * zoom;

        if (right - left <= viewportWidth) {
            reader.panX = -(left + right) / 2;
        } else {
            const minimum = viewportWidth / 2 - right;
            const maximum = -viewportWidth / 2 - left;
            reader.panX = Math.max(minimum, Math.min(maximum, Number(reader.panX) || 0));
        }

        if (bottom - top <= viewportHeight) {
            reader.panY = -(top + bottom) / 2;
        } else {
            const minimum = viewportHeight / 2 - bottom;
            const maximum = -viewportHeight / 2 - top;
            reader.panY = Math.max(minimum, Math.min(maximum, Number(reader.panY) || 0));
        }
    }

    function installZoomController(session) {
        const reader = session.overlay.__advancedBooksReaderSession;
        if (!reader || typeof reader.setZoom !== 'function' || reader.__advancedBooksZoomControllerInstalled) return;

        const fallbackSetZoom = reader.setZoom.bind(reader);
        const applyTransform = typeof reader.applyTransform === 'function'
            ? reader.applyTransform.bind(reader)
            : null;
        const syncControlState = typeof reader.syncControlState === 'function'
            ? reader.syncControlState.bind(reader)
            : null;
        if (!applyTransform) return;

        reader.__advancedBooksZoomControllerInstalled = true;
        reader.__advancedBooksOriginalSetZoom = fallbackSetZoom;
        reader.clampPan = () => clampPagedPan(reader, session.stage, session.pages);
        reader.syncGestureInput = () => {
            session.syncTouchAction();
            session.updateGrabCursor();
        };

        reader.setZoom = (value, anchor = null, options = null) => {
            if (!session.overlay.isConnected) return;
            if (!Number.isFinite(value)) return;

            const snap = options?.snap !== false;
            const requested = clampZoom(value);
            const nextZoom = snap ? Math.round(requested * 20) / 20 : requested;
            const oldZoom = Number.isFinite(reader.zoom) && reader.zoom > 0 ? reader.zoom : 1;
            const oldPanX = Number.isFinite(reader.panX) ? reader.panX : 0;
            const oldPanY = Number.isFinite(reader.panY) ? reader.panY : 0;
            const focus = normalizeAnchor(session.stage, anchor);
            const sourceFocus = options?.fromAnchor
                ? normalizeAnchor(session.stage, options.fromAnchor)
                : focus;
            const continuous = reader.isContinuous?.() ?? session.isContinuous();

            if (continuous) {
                const hit = document.elementFromPoint(sourceFocus.clientX, sourceFocus.clientY);
                const pointed = hit?.closest?.('.advancedBooksReaderPageSlot');
                const slot = pointed?.isConnected
                    ? pointed
                    : reader.continuousElements?.[reader.currentPage] ?? null;
                const element = hit instanceof HTMLImageElement && hit.closest('.advancedBooksReaderPageSlot') === slot
                    ? hit
                    : slot;
                const before = element?.getBoundingClientRect?.();
                const xRatio = before?.width > 0
                    ? Math.max(0, Math.min(1, (sourceFocus.clientX - before.left) / before.width))
                    : .5;
                const yRatio = before?.height > 0
                    ? Math.max(0, Math.min(1, (sourceFocus.clientY - before.top) / before.height))
                    : .5;

                reader.zoom = nextZoom;
                applyTransform();
                syncControlState?.();

                if (element?.isConnected) {
                    const after = element.getBoundingClientRect();
                    session.stage.scrollLeft += after.left + after.width * xRatio - focus.clientX;
                    session.stage.scrollTop += after.top + after.height * yRatio - focus.clientY;
                }
                session.syncTouchAction?.();
                session.updateGrabCursor?.();
                return;
            }

            reader.zoom = nextZoom;
            if (nextZoom <= 1) {
                reader.panX = 0;
                reader.panY = 0;
            } else {
                const ratio = nextZoom / oldZoom;
                const sourceX = sourceFocus.localX - sourceFocus.centerX;
                const sourceY = sourceFocus.localY - sourceFocus.centerY;
                const targetX = focus.localX - focus.centerX;
                const targetY = focus.localY - focus.centerY;
                reader.panX = oldPanX * ratio + targetX - ratio * sourceX;
                reader.panY = oldPanY * ratio + targetY - ratio * sourceY;
                clampPagedPan(reader, session.stage, session.pages);
            }
            applyTransform();
            syncControlState?.();
            session.updateGrabCursor?.();
        };
    }

    function findZoomOperations(targetZoom) {
        const start = 20;
        const target = Math.min(80, Math.max(10, Math.round(clampZoom(targetZoom) * 20)));
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

    function commitZoom(session, targetZoom, anchor = null) {
        if (!session?.overlay?.isConnected) return;
        const reader = session.overlay.__advancedBooksReaderSession;
        if (reader && typeof reader.setZoom === 'function') {
            reader.setZoom(targetZoom, anchor);
            return;
        }

        const toolbar = session.overlay.querySelector('.advancedBooksReaderToolbar');
        const reset = toolbar?.querySelector('button[data-ab-action="zoom-reset"],button[title="Reset zoom"]');
        const plus = toolbar?.querySelector('button[data-ab-action="zoom-in"],button[title="Zoom in"]');
        const minus = toolbar?.querySelector('button[data-ab-action="zoom-out"],button[title="Zoom out"]');
        if (!toolbar || !reset) return;

        reset.click();
        for (const operation of findZoomOperations(targetZoom)) {
            if (operation === 'plus') plus?.click();
            else if (operation === 'minus') minus?.click();
            else {
                session.stage.dispatchEvent(new WheelEvent('wheel', {
                    bubbles: true,
                    cancelable: true,
                    ctrlKey: true,
                    deltaY: operation === 'wheelPlus' ? -100 : 100,
                    clientX: anchor?.clientX ?? 0,
                    clientY: anchor?.clientY ?? 0
                }));
            }
        }
    }

    class PinchSession {
        constructor(overlay) {
            this.overlay = overlay;
            this.stage = overlay.querySelector('.advancedBooksReaderStage');
            this.pages = overlay.querySelector('.advancedBooksReaderPages');
            this.pointers = new Map();
            this.tapStarts = new Map();
            this.pinchPointerIds = [];
            this.pinching = false;
            this.suppressUntilRelease = false;
            this.startDistance = 0;
            this.startZoom = 1;
            this.targetZoom = 1;
            this.startMidpoint = null;
            this.currentMidpoint = null;
            this.renderedPinchMidpoint = null;
            this.pinchFrame = 0;
            this.pendingPinchZoom = null;
            this.touchPan = null;
            this.lastTap = null;
            this.tapTimer = null;
            this.doubleTapBaseZoom = 1;
            this.doubleTapZoomed = false;
            this.mouseDrag = null;
            this.pendingPageMotion = null;
            this.pageMotionTimer = null;
            this.pageMutationObserver = null;
            this.removalObserver = null;

            this.onPointerDown = event => this.pointerDown(event);
            this.onPointerMove = event => this.pointerMove(event);
            this.onPointerEnd = event => this.pointerEnd(event);
            this.onWheel = event => this.wheel(event);
        }

        get reader() {
            return this.overlay.__advancedBooksReaderSession;
        }

        attach() {
            if (!this.stage || !this.pages) return false;
            ensureInteractionStyles();
            installZoomController(this);
            this.updateGrabCursor();
            this.syncTouchAction();
            this.pageMutationObserver = new MutationObserver(() => {
                this.applyPendingPageMotion();
                this.updateGrabCursor();
                this.syncTouchAction();
            });
            this.pageMutationObserver.observe(this.pages, { childList: true, attributes: true, attributeFilter: ['class'] });
            this.pageMutationObserver.observe(this.stage, { attributes: true, attributeFilter: ['class'] });
            this.stage.addEventListener('pointerdown', this.onPointerDown, true);
            this.stage.addEventListener('pointermove', this.onPointerMove, true);
            this.stage.addEventListener('pointerup', this.onPointerEnd, true);
            this.stage.addEventListener('pointercancel', this.onPointerEnd, true);
            this.stage.addEventListener('wheel', this.onWheel, { capture: true, passive: false });

            this.removalObserver = new MutationObserver(() => {
                if (!this.overlay.isConnected) this.dispose();
            });
            this.removalObserver.observe(document.body, { childList: true, subtree: true });
            return true;
        }

        isContinuous() {
            return this.stage?.classList.contains('ab-continuous')
                || this.pages?.classList.contains('ab-continuous');
        }

        cancelPendingTap(clearLastTap = false) {
            window.clearTimeout(this.tapTimer);
            this.tapTimer = null;
            if (clearLastTap) this.lastTap = null;
        }

        updateGrabCursor() {
            if (!this.stage || !this.pages) return;
            const overflow = this.stage.scrollWidth > this.stage.clientWidth + 2
                || this.stage.scrollHeight > this.stage.clientHeight + 2;
            this.stage.classList.toggle('ab-grab-scroll', this.isContinuous() || overflow);
            this.pages.classList.toggle('ab-grab-page', !this.isContinuous() && currentZoom(this.overlay) > 1);
        }

        reducedMotion() {
            return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;
        }

        syncTouchAction() {
            if (!this.stage) return;
            if (this.reader?.touchGestures === false) {
                this.stage.style.touchAction = this.isContinuous() ? 'pan-x pan-y' : 'pan-y';
                return;
            }
            this.stage.style.touchAction = this.reader?.externalPinchActive || currentZoom(this.overlay) > 1
                ? 'none'
                : 'pan-y';
        }

        schedulePinchZoom() {
            if (!this.currentMidpoint) return;
            const anchor = { clientX: this.currentMidpoint.x, clientY: this.currentMidpoint.y };
            const from = this.renderedPinchMidpoint
                ? { clientX: this.renderedPinchMidpoint.x, clientY: this.renderedPinchMidpoint.y }
                : anchor;
            this.pendingPinchZoom = { zoom: this.targetZoom, anchor, from };
            if (this.pinchFrame) return;
            this.pinchFrame = requestAnimationFrame(() => {
                this.pinchFrame = 0;
                const pending = this.pendingPinchZoom;
                this.pendingPinchZoom = null;
                if (!pending || !this.pinching || !this.overlay.isConnected) return;
                this.reader?.setZoom?.(pending.zoom, pending.anchor, {
                    snap: false,
                    fromAnchor: pending.from
                });
                this.renderedPinchMidpoint = {
                    x: pending.anchor.clientX,
                    y: pending.anchor.clientY
                };
            });
        }

        flushPinchZoom() {
            if (this.pinchFrame) cancelAnimationFrame(this.pinchFrame);
            this.pinchFrame = 0;
            const pending = this.pendingPinchZoom;
            this.pendingPinchZoom = null;
            if (pending && this.overlay.isConnected) {
                this.reader?.setZoom?.(pending.zoom, pending.anchor, {
                    snap: false,
                    fromAnchor: pending.from
                });
                this.renderedPinchMidpoint = {
                    x: pending.anchor.clientX,
                    y: pending.anchor.clientY
                };
            }
        }

        markPageMotion(side) {
            this.pendingPageMotion = side;
            this.pages.dataset.abPageMotion = side;
            window.clearTimeout(this.pageMotionTimer);
            this.pageMotionTimer = window.setTimeout(() => {
                this.pendingPageMotion = null;
                if (this.pages.dataset.abPageMotion === side) delete this.pages.dataset.abPageMotion;
            }, 1500);
        }

        applyPendingPageMotion() {
            if (!this.pendingPageMotion || this.isContinuous()) return;
            const motion = this.pendingPageMotion;
            this.pendingPageMotion = null;
            this.pages.dataset.abPageMotion = motion;
            window.clearTimeout(this.pageMotionTimer);
            this.pageMotionTimer = window.setTimeout(() => {
                if (this.pages.dataset.abPageMotion === motion) delete this.pages.dataset.abPageMotion;
            }, pageMotionDurationMs + 80);
        }

        navigateHorizontal(leftSide) {
            const reader = this.reader;
            if (!reader) return;
            this.markPageMotion(leftSide ? 'left' : 'right');
            if (reader.direction === 'rtl') leftSide ? reader.next?.() : reader.previous?.();
            else leftSide ? reader.previous?.() : reader.next?.();
        }

        navigateVertical(topSide) {
            const reader = this.reader;
            if (!reader) return;
            const delta = topSide ? -1 : 1;
            const target = Math.max(0, Math.min((reader.pageCount ?? 1) - 1, (reader.currentPage ?? 0) + delta));
            reader.goTo?.(target, this.reducedMotion() ? 'auto' : 'smooth');
        }

        handleMousePointerDown(event) {
            if ((event.button ?? 0) !== 0) return false;
            const zoom = currentZoom(this.overlay);
            const overflow = this.stage.scrollWidth > this.stage.clientWidth + 2
                || this.stage.scrollHeight > this.stage.clientHeight + 2;
            const scrollPan = this.isContinuous() || (zoom <= 1 && overflow);
            this.mouseDrag = {
                id: event.pointerId,
                x: event.clientX,
                y: event.clientY,
                scrollLeft: this.stage.scrollLeft,
                scrollTop: this.stage.scrollTop,
                moved: false,
                scrollPan
            };
            if (scrollPan) {
                this.stage.setPointerCapture?.(event.pointerId);
                this.stage.classList.add('ab-grabbing');
                event.preventDefault();
                event.stopImmediatePropagation();
                return true;
            }
            return false;
        }

        handleMousePointerMove(event) {
            const drag = this.mouseDrag;
            if (!drag || drag.id !== event.pointerId) return false;
            if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) > mouseDragThreshold) drag.moved = true;
            if (!drag.scrollPan) return false;
            this.stage.scrollLeft = drag.scrollLeft - (event.clientX - drag.x);
            this.stage.scrollTop = drag.scrollTop - (event.clientY - drag.y);
            event.preventDefault();
            event.stopImmediatePropagation();
            return true;
        }

        handleMousePointerEnd(event) {
            const drag = this.mouseDrag;
            if (!drag || drag.id !== event.pointerId) return false;
            this.mouseDrag = null;

            if (drag.scrollPan) {
                try { this.stage.releasePointerCapture?.(event.pointerId); } catch {}
                this.stage.classList.remove('ab-grabbing');
                if (this.reader) this.reader.suppressNextStageClick = true;
                if (!drag.moved) {
                    this.handleMouseClick(event.clientX, event.clientY);
                }
                event.preventDefault();
                event.stopImmediatePropagation();
                return true;
            }

            if (!drag.moved && !this.isContinuous() && currentZoom(this.overlay) <= 1) {
                const rect = this.stage.getBoundingClientRect();
                const ratio = (event.clientX - rect.left) / Math.max(1, rect.width);
                if (ratio < navigationZoneEdge || ratio > 1 - navigationZoneEdge) {
                    this.markPageMotion(ratio < navigationZoneEdge ? 'left' : 'right');
                }
            }
            return false;
        }

        handleMouseClick(clientX, clientY) {
            const reader = this.reader;
            if (!reader) return;
            const rect = this.stage.getBoundingClientRect();
            if (this.isContinuous()) {
                const ratio = (clientY - rect.top) / Math.max(1, rect.height);
                if (ratio >= navigationZoneEdge && ratio <= 1 - navigationZoneEdge) reader.toggleControls?.();
                else this.navigateVertical(ratio < navigationZoneEdge);
                return;
            }

            const ratio = (clientX - rect.left) / Math.max(1, rect.width);
            if (ratio >= navigationZoneEdge && ratio <= 1 - navigationZoneEdge) reader.toggleControls?.();
            else this.navigateHorizontal(ratio < navigationZoneEdge);
        }

        pointerDown(event) {
            if (event.pointerType === 'mouse') {
                this.handleMousePointerDown(event);
                return;
            }
            if (event.pointerType !== 'touch') return;
            if (this.reader?.touchGestures === false) return;

            const point = { x: event.clientX, y: event.clientY };
            this.pointers.set(event.pointerId, point);
            this.tapStarts.set(event.pointerId, {
                ...point,
                time: performance.now(),
                moved: false
            });

            if (this.pinching || this.suppressUntilRelease) {
                event.preventDefault();
                event.stopImmediatePropagation();
                return;
            }

            if (this.pointers.size < 2) {
                if (this.isContinuous() && currentZoom(this.overlay) > 1) {
                    this.touchPan = {
                        id: event.pointerId,
                        x: event.clientX,
                        y: event.clientY,
                        scrollLeft: this.stage.scrollLeft,
                        scrollTop: this.stage.scrollTop,
                        moved: false
                    };
                }
                return;
            }

            this.cancelPendingTap(true);
            this.touchPan = null;
            this.suppressUntilRelease = true;
            this.reader?.beginExternalPinch?.();
            this.tryBeginPinch();
            event.preventDefault();
            event.stopImmediatePropagation();
        }

        tryBeginPinch() {
            if (this.pinching || this.pointers.size < 2) return false;
            const entries = Array.from(this.pointers.entries()).slice(0, 2);
            const first = entries[0][1];
            const second = entries[1][1];
            const initialDistance = distance(first, second);
            if (initialDistance < minimumPinchDistance) return false;

            this.pinching = true;
            this.pinchPointerIds = [entries[0][0], entries[1][0]];
            this.startDistance = initialDistance;
            this.startZoom = currentZoom(this.overlay);
            this.targetZoom = this.startZoom;
            this.startMidpoint = midpoint(first, second);
            this.currentMidpoint = this.startMidpoint;
            this.renderedPinchMidpoint = this.startMidpoint;
            this.pendingPinchZoom = null;
            this.syncTouchAction();

            for (const pointerId of this.pinchPointerIds) {
                try {
                    this.stage.setPointerCapture?.(pointerId);
                } catch {
                    // Pointer capture is an optimization only.
                }
            }
            return true;
        }

        pointerMove(event) {
            if (event.pointerType === 'mouse') {
                this.handleMousePointerMove(event);
                return;
            }
            if (event.pointerType !== 'touch') return;

            const pointer = this.pointers.get(event.pointerId);
            if (pointer) {
                pointer.x = event.clientX;
                pointer.y = event.clientY;
            }
            const tapStart = this.tapStarts.get(event.pointerId);
            if (tapStart && Math.hypot(event.clientX - tapStart.x, event.clientY - tapStart.y) > tapMovementTolerance) {
                tapStart.moved = true;
                this.cancelPendingTap(true);
            }

            if (!this.pinching && this.suppressUntilRelease && this.pointers.size >= 2) {
                this.tryBeginPinch();
            }

            if (!this.pinching) {
                if (this.suppressUntilRelease) {
                    event.preventDefault();
                    event.stopImmediatePropagation();
                    return;
                }

                if (this.touchPan?.id === event.pointerId && this.isContinuous() && currentZoom(this.overlay) > 1) {
                    const dx = event.clientX - this.touchPan.x;
                    const dy = event.clientY - this.touchPan.y;
                    if (Math.hypot(dx, dy) > 4) this.touchPan.moved = true;
                    this.stage.scrollLeft = this.touchPan.scrollLeft - dx;
                    this.stage.scrollTop = this.touchPan.scrollTop - dy;
                    if (this.touchPan.moved && this.reader) this.reader.suppressNextStageClick = true;
                    event.preventDefault();
                    event.stopImmediatePropagation();
                }
                return;
            }

            if (!this.pinchPointerIds.includes(event.pointerId)) {
                event.preventDefault();
                event.stopImmediatePropagation();
                return;
            }

            const first = this.pointers.get(this.pinchPointerIds[0]);
            const second = this.pointers.get(this.pinchPointerIds[1]);
            if (!first || !second) return;
            const currentDistance = distance(first, second);
            if (currentDistance < minimumPinchDistance) return;

            const ratio = currentDistance / this.startDistance;
            this.targetZoom = clampZoom(this.startZoom * ratio);
            this.currentMidpoint = midpoint(first, second);
            this.schedulePinchZoom();

            event.preventDefault();
            event.stopImmediatePropagation();
        }

        pointerEnd(event) {
            if (event.pointerType === 'mouse') {
                this.handleMousePointerEnd(event);
                return;
            }
            if (event.pointerType !== 'touch') return;

            const tapStart = this.tapStarts.get(event.pointerId);
            this.tapStarts.delete(event.pointerId);
            const wasTracked = this.pointers.delete(event.pointerId);
            if (!wasTracked) return;

            const endedActivePinchPointer = this.pinching && this.pinchPointerIds.includes(event.pointerId);
            if (endedActivePinchPointer) this.finishPinch();

            if (this.suppressUntilRelease) {
                event.preventDefault();
                event.stopImmediatePropagation();
                if (this.pointers.size === 0) {
                    this.suppressUntilRelease = false;
                    this.pinchPointerIds = [];
                    this.reader?.endExternalPinch?.();
                    this.syncTouchAction();
                }
                return;
            }

            const pan = this.touchPan?.id === event.pointerId ? this.touchPan : null;
            if (pan) this.touchPan = null;
            if (pan?.moved) {
                if (this.reader) {
                    this.reader.pointerStart = null;
                    this.reader.suppressNextStageClick = true;
                }
                event.preventDefault();
                event.stopImmediatePropagation();
                return;
            }

            if (event.type === 'pointercancel') {
                this.cancelPendingTap(true);
                return;
            }

            const duration = tapStart ? performance.now() - tapStart.time : Number.POSITIVE_INFINITY;
            const isTap = tapStart
                && !tapStart.moved
                && duration <= tapMaximumDurationMs
                && Math.hypot(event.clientX - tapStart.x, event.clientY - tapStart.y) <= tapMovementTolerance;

            if (!isTap) return;

            if (this.reader) {
                this.reader.pointerStart = null;
                if (this.isContinuous()) this.reader.suppressNextStageClick = true;
            }
            try {
                this.stage.releasePointerCapture?.(event.pointerId);
            } catch {
                // Capture may already be released by the browser.
            }
            event.preventDefault();
            event.stopImmediatePropagation();
            this.handleTap(event.clientX, event.clientY);
        }

        handleTap(clientX, clientY) {
            const now = performance.now();
            const current = { x: clientX, y: clientY, time: now };
            const previous = this.lastTap;

            if (previous
                && now - previous.time <= doubleTapDelayMs
                && Math.hypot(clientX - previous.x, clientY - previous.y) <= doubleTapDistance) {
                this.cancelPendingTap(true);
                this.handleDoubleTap(clientX, clientY);
                return;
            }

            this.lastTap = current;
            this.cancelPendingTap(false);
            this.tapTimer = window.setTimeout(() => {
                this.tapTimer = null;
                const pending = this.lastTap;
                this.lastTap = null;
                if (pending) this.handleSingleTap(pending.x, pending.y);
            }, doubleTapDelayMs);
        }

        handleDoubleTap(clientX, clientY) {
            const reader = this.reader;
            if (!reader || !this.overlay.isConnected) return;

            const zoom = currentZoom(this.overlay);
            let target;
            if (zoom > 1.05) {
                target = this.doubleTapZoomed ? this.doubleTapBaseZoom : 1;
                this.doubleTapZoomed = false;
            } else {
                this.doubleTapBaseZoom = zoom;
                this.doubleTapZoomed = true;
                target = Math.max(doubleTapZoom, zoom);
            }

            reader.setZoom?.(target, { clientX, clientY });
        }

        handleSingleTap(clientX, clientY) {
            const reader = this.reader;
            if (!reader || !this.overlay.isConnected) return;

            const rect = this.stage.getBoundingClientRect();
            if (this.isContinuous()) {
                const ratio = (clientY - rect.top) / Math.max(1, rect.height);
                if (ratio >= navigationZoneEdge && ratio <= 1 - navigationZoneEdge) {
                    reader.toggleControls?.();
                    return;
                }
                this.navigateVertical(ratio < navigationZoneEdge);
                return;
            }

            if (currentZoom(this.overlay) > 1) {
                reader.toggleControls?.();
                return;
            }

            const ratio = (clientX - rect.left) / Math.max(1, rect.width);
            if (ratio >= navigationZoneEdge && ratio <= 1 - navigationZoneEdge) {
                reader.toggleControls?.();
                return;
            }

            this.navigateHorizontal(ratio < navigationZoneEdge);
        }

        wheel(event) {
            const reader = this.reader;
            if (!reader || !this.overlay.isConnected) return;

            const zoom = currentZoom(this.overlay);
            const shouldZoom = event.ctrlKey || (!this.isContinuous() && zoom > 1);
            if (!shouldZoom) return;

            event.preventDefault();
            event.stopImmediatePropagation();
            reader.setZoom?.(
                zoom + (event.deltaY < 0 ? 0.15 : -0.15),
                { clientX: event.clientX, clientY: event.clientY }
            );
        }

        finishPinch() {
            if (!this.pinching) return;
            this.flushPinchZoom();
            this.pinching = false;

            const normalized = Math.round(clampZoom(this.targetZoom) * 20) / 20;
            const anchor = this.currentMidpoint ?? this.startMidpoint;
            const anchorPoint = anchor ? { clientX: anchor.x, clientY: anchor.y } : null;
            if (Math.abs(normalized - this.startZoom) >= minimumCommittedZoomDelta) {
                commitZoom(this, normalized, anchorPoint);
            } else {
                commitZoom(this, this.startZoom, anchorPoint);
            }
            this.pinchPointerIds = [];
        }

        dispose() {
            this.cancelPendingTap(true);
            if (this.pinchFrame) cancelAnimationFrame(this.pinchFrame);
            this.pinchFrame = 0;
            this.pendingPinchZoom = null;
            this.renderedPinchMidpoint = null;
            this.stage?.removeEventListener('pointerdown', this.onPointerDown, true);
            this.stage?.removeEventListener('pointermove', this.onPointerMove, true);
            this.stage?.removeEventListener('pointerup', this.onPointerEnd, true);
            this.stage?.removeEventListener('pointercancel', this.onPointerEnd, true);
            this.stage?.removeEventListener('wheel', this.onWheel, true);
            this.pageMutationObserver?.disconnect();
            this.removalObserver?.disconnect();
            this.pointers.clear();
            this.tapStarts.clear();
            this.pinchPointerIds = [];
            this.touchPan = null;
            this.mouseDrag = null;
            window.clearTimeout(this.pageMotionTimer);
            this.pinching = false;
            this.suppressUntilRelease = false;
            this.reader?.endExternalPinch?.();
            if (activeSession === this) activeSession = null;
        }
    }

    function attachToOverlay(overlay) {
        if (!overlay?.isConnected || overlay.dataset.advancedBooksGesturesAttached === 'true') return;
        overlay.dataset.advancedBooksGesturesAttached = 'true';
        activeSession?.dispose();
        const session = new PinchSession(overlay);
        if (session.attach()) activeSession = session;
    }

    function scan() {
        const overlays = document.querySelectorAll('.advancedBooksReaderOverlay');
        const overlay = overlays.length ? overlays[overlays.length - 1] : null;
        if (overlay) attachToOverlay(overlay);
    }

    new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true });
    scan();
}());
