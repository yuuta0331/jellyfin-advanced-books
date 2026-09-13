(function () {
    'use strict';

    if (window.AdvancedBooksZoom) return;

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
        if (!Number.isFinite(reader.zoom) || reader.zoom <= 1) {
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

        const left = (bounds.left - pageWidth / 2) * reader.zoom;
        const right = (bounds.right - pageWidth / 2) * reader.zoom;
        const top = (bounds.top - pageHeight / 2) * reader.zoom;
        const bottom = (bounds.bottom - pageHeight / 2) * reader.zoom;

        if (right - left <= viewportWidth) {
            reader.panX = -(left + right) / 2;
        } else {
            reader.panX = Math.max(
                viewportWidth / 2 - right,
                Math.min(-viewportWidth / 2 - left, Number(reader.panX) || 0)
            );
        }

        if (bottom - top <= viewportHeight) {
            reader.panY = -(top + bottom) / 2;
        } else {
            reader.panY = Math.max(
                viewportHeight / 2 - bottom,
                Math.min(-viewportHeight / 2 - top, Number(reader.panY) || 0)
            );
        }
    }

    function captureContinuousAnchor(reader, sourceFocus) {
        const hit = document.elementFromPoint?.(sourceFocus.clientX, sourceFocus.clientY) ?? null;
        const pointedSlot = hit?.closest?.('.advancedBooksReaderPageSlot');
        const slot = pointedSlot?.isConnected
            ? pointedSlot
            : reader.continuousElements?.[reader.currentPage] ?? null;
        const element = hit?.tagName === 'IMG' && hit.closest?.('.advancedBooksReaderPageSlot') === slot
            ? hit
            : slot;
        const rect = element?.getBoundingClientRect?.();
        return {
            element,
            xRatio: rect?.width > 0
                ? Math.max(0, Math.min(1, (sourceFocus.clientX - rect.left) / rect.width))
                : .5,
            yRatio: rect?.height > 0
                ? Math.max(0, Math.min(1, (sourceFocus.clientY - rect.top) / rect.height))
                : .5
        };
    }

    function restoreContinuousAnchor(stage, captured, targetFocus) {
        if (!captured?.element?.isConnected) return;
        const rect = captured.element.getBoundingClientRect();
        stage.scrollLeft += rect.left + rect.width * captured.xRatio - targetFocus.clientX;
        stage.scrollTop += rect.top + rect.height * captured.yRatio - targetFocus.clientY;
    }

    window.AdvancedBooksZoom = {
        normalizeAnchor,
        clampPagedPan,
        captureContinuousAnchor,
        restoreContinuousAnchor
    };
}());
