(function () {
    'use strict';

    if (window.__jellyfinAdvancedBooksGesturesLoaded) return;
    window.__jellyfinAdvancedBooksGesturesLoaded = true;

    const minimumZoom = 0.5;
    const maximumZoom = 4;
    const minimumPinchDistance = 24;
    const minimumCommittedZoomDelta = 0.025;
    let activeSession = null;

    function clampZoom(value) {
        if (!Number.isFinite(value)) return 1;
        return Math.min(maximumZoom, Math.max(minimumZoom, value));
    }

    function currentZoom(overlay) {
        const reset = overlay.querySelector('.advancedBooksReaderToolbar button[title="Reset zoom"]');
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

    function findZoomOperations(targetZoom) {
        // Reader buttons move by 25%; Ctrl+wheel moves by 15%. Starting from the
        // reset value (100%), those operations can reach every 5% step.
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

    function commitZoom(session, targetZoom) {
        if (!session?.overlay?.isConnected) return;
        const reader = session.overlay.__advancedBooksReaderSession;
        if (reader && typeof reader.setZoom === 'function') {
            reader.setZoom(targetZoom);
            return;
        }

        const toolbar = session.overlay.querySelector('.advancedBooksReaderToolbar');
        const reset = toolbar?.querySelector('button[title="Reset zoom"]');
        const plus = toolbar?.querySelector('button[title="Zoom in"]');
        const minus = toolbar?.querySelector('button[title="Zoom out"]');
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
                    deltaY: operation === 'wheelPlus' ? -100 : 100
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
            this.pinchPointerIds = [];
            this.pinching = false;
            this.suppressUntilRelease = false;
            this.startDistance = 0;
            this.startZoom = 1;
            this.targetZoom = 1;
            this.startMidpoint = null;
            this.startScrollLeft = 0;
            this.startScrollTop = 0;
            this.originalTransform = '';
            this.originalTransformOrigin = '';
            this.originalTransition = '';
            this.originalWillChange = '';
            this.removalObserver = null;

            this.onPointerDown = event => this.pointerDown(event);
            this.onPointerMove = event => this.pointerMove(event);
            this.onPointerEnd = event => this.pointerEnd(event);
        }

        attach() {
            if (!this.stage || !this.pages) return false;
            // Capture phase lets the pinch bridge suppress the reader's single-pointer
            // swipe/pan handling only after a second touch has committed to a pinch.
            this.stage.addEventListener('pointerdown', this.onPointerDown, true);
            this.stage.addEventListener('pointermove', this.onPointerMove, true);
            this.stage.addEventListener('pointerup', this.onPointerEnd, true);
            this.stage.addEventListener('pointercancel', this.onPointerEnd, true);

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

        pointerDown(event) {
            if (event.pointerType !== 'touch') return;
            this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

            if (this.pinching || this.suppressUntilRelease) {
                event.preventDefault();
                event.stopImmediatePropagation();
                return;
            }

            if (this.pointers.size < 2) return;

            // From the second touch onward, the pinch layer exclusively owns touch
            // movement until every touch is released.
            this.suppressUntilRelease = true;
            this.overlay.__advancedBooksReaderSession?.beginExternalPinch?.();
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
            this.startScrollLeft = this.stage.scrollLeft;
            this.startScrollTop = this.stage.scrollTop;
            this.originalTransform = this.pages.style.transform;
            this.originalTransformOrigin = this.pages.style.transformOrigin;
            this.originalTransition = this.pages.style.transition;
            this.originalWillChange = this.pages.style.willChange;
            if (this.isContinuous()) {
                const pagesRect = this.pages.getBoundingClientRect();
                const originX = this.startMidpoint.x - pagesRect.left;
                const originY = this.startMidpoint.y - pagesRect.top;
                this.pages.style.transformOrigin = `${originX}px ${originY}px`;
            }
            this.pages.style.transition = 'none';
            this.pages.style.willChange = 'transform';

            for (const pointerId of this.pinchPointerIds) {
                try {
                    this.stage.setPointerCapture?.(pointerId);
                } catch {
                    // Pointer capture is an optimization. The gesture can still proceed
                    // while both pointers remain over the reader stage.
                }
            }
            return true;
        }

        pointerMove(event) {
            if (event.pointerType !== 'touch') return;
            if (this.pointers.has(event.pointerId)) {
                this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
            }

            if (!this.pinching && this.suppressUntilRelease && this.pointers.size >= 2) {
                this.tryBeginPinch();
            }

            if (!this.pinching) {
                if (this.suppressUntilRelease) {
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
            const previewRatio = this.targetZoom / Math.max(this.startZoom, 0.01);

            // Keep the page anchored while pinching. In continuous modes some WebViews
            // may begin a native one-finger pan before the second touch arrives; restoring
            // the captured scroll position prevents the document itself drifting.
            if (this.isContinuous()) {
                this.stage.scrollLeft = this.startScrollLeft;
                this.stage.scrollTop = this.startScrollTop;
            }

            const baseTransform = this.originalTransform && this.originalTransform !== 'none'
                ? this.originalTransform
                : '';
            this.pages.style.transform = `${baseTransform} scale(${previewRatio})`.trim();

            event.preventDefault();
            event.stopImmediatePropagation();
        }

        pointerEnd(event) {
            if (event.pointerType !== 'touch') return;
            const wasTracked = this.pointers.delete(event.pointerId);
            if (!wasTracked) return;

            const endedActivePinchPointer = this.pinching && this.pinchPointerIds.includes(event.pointerId);
            if (endedActivePinchPointer) this.finishPinch();

            if (this.suppressUntilRelease) {
                // Suppress all final pointer-up events so the reader's original first
                // pointer cannot be interpreted as a page-turn swipe after multi-touch.
                event.preventDefault();
                event.stopImmediatePropagation();
                if (this.pointers.size === 0) {
                    this.suppressUntilRelease = false;
                    this.pinchPointerIds = [];
                    this.overlay.__advancedBooksReaderSession?.endExternalPinch?.();
                }
            }
        }

        finishPinch() {
            if (!this.pinching) return;
            this.pinching = false;
            this.pages.style.transform = this.originalTransform;
            this.pages.style.transformOrigin = this.originalTransformOrigin;
            this.pages.style.transition = this.originalTransition;
            this.pages.style.willChange = this.originalWillChange;

            // Commit on the same 5% grid used by persisted reader preferences. Avoid
            // touching the reader state when the gesture rounded back to its start zoom,
            // which preserves an existing one-finger pan offset above 100%.
            const normalized = Math.round(clampZoom(this.targetZoom) * 20) / 20;
            if (Math.abs(normalized - this.startZoom) >= minimumCommittedZoomDelta) {
                commitZoom(this, normalized);
            }
            this.pinchPointerIds = [];
        }

        dispose() {
            if (this.pinching) {
                this.pages.style.transform = this.originalTransform;
                this.pages.style.transformOrigin = this.originalTransformOrigin;
                this.pages.style.transition = this.originalTransition;
                this.pages.style.willChange = this.originalWillChange;
            }
            this.stage?.removeEventListener('pointerdown', this.onPointerDown, true);
            this.stage?.removeEventListener('pointermove', this.onPointerMove, true);
            this.stage?.removeEventListener('pointerup', this.onPointerEnd, true);
            this.stage?.removeEventListener('pointercancel', this.onPointerEnd, true);
            this.removalObserver?.disconnect();
            this.pointers.clear();
            this.pinchPointerIds = [];
            this.pinching = false;
            this.suppressUntilRelease = false;
            this.overlay.__advancedBooksReaderSession?.endExternalPinch?.();
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
