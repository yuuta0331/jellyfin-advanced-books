#!/usr/bin/env python3
"""Validate source-level Advanced Reader render invariants that prevent duplicate pages."""

from pathlib import Path

READER = Path("src/Jellyfin.Plugin.AdvancedBooks/Reader/advancedBooksReader.js")
ZOOM = Path("src/Jellyfin.Plugin.AdvancedBooks/Reader/advancedBooksZoom.js")
GESTURES = Path("src/Jellyfin.Plugin.AdvancedBooks/Reader/advancedBooksGestures.js")
PREFERENCES = Path("src/Jellyfin.Plugin.AdvancedBooks/Reader/advancedBooksPreferences.js")
INTEGRATION = Path("src/Jellyfin.Plugin.AdvancedBooks/Reader/advancedBooksIntegration.js")
REGISTRATION = Path("src/Jellyfin.Plugin.AdvancedBooks/Services/JavaScriptInjectorRegistrationService.cs")


def main() -> int:
    text = READER.read_text(encoding="utf-8")
    zoom = ZOOM.read_text(encoding="utf-8")
    gestures = GESTURES.read_text(encoding="utf-8")
    preferences = PREFERENCES.read_text(encoding="utf-8")
    integration = INTEGRATION.read_text(encoding="utf-8")
    registration = REGISTRATION.read_text(encoding="utf-8")

    required = {
        "continuous image replacement": "slot.replaceChildren(image)",
        "placeholder replacement": "slot.replaceChildren(placeholder)",
        "stale-load generation guard": "abLoadGeneration",
        "page identity response verification": "X-AdvancedBooks-Page-Index",
        "pre-render spread orientation probe": "ensurePageAspectRatio",
        "canonical odd-page double grouping": "(start % 2) === 1",
        "known-dimensions spread guard": "this.pageAspectRatios.has(start + 1)",
        "final-page single-spread guard": "start + 1 < last",
        "continuous image ownership guard": "slot.querySelector('img') !== image",
        "defensive duplicate-image CSS guard": ".advancedBooksReaderPageSlot>img~img{display:none!important}",
        "direct reader launch implementation": "async function openReaderItem(itemId, startMode = 'resume')",
        "public direct reader API": "openItem: openReaderItem",
        "public support probe API": "supportsItem: supportsReaderItem",
    }
    forbidden = {
        "append-based continuous page insertion": "slot.appendChild(image)",
        "legacy global spread realignment": "spreadStartFor(",
    }
    integration_required = {
        "server-authoritative native resume": "return 'resume';",
        "context-menu start-mode routing": "startModeForAction(actionSheetItem, command)",
    }
    integration_forbidden = {
        "stale DOM playback-position routing": "data-positionticks",
        "context menu forced page-one play": "command === 'resume' ? 'resume' : 'start'",
    }
    zoom_required = {
        "focal anchor normalization": "function normalizeAnchor(stage, anchor)",
        "rendered paged-content clamp": "function clampPagedPan(reader, stage, pages)",
        "continuous image anchor capture": "function captureContinuousAnchor(reader, sourceFocus)",
        "continuous source-to-target restore": "function restoreContinuousAnchor(stage, captured, targetFocus)",
        "actual-image continuous anchor": "hit?.tagName === 'IMG'",
    }
    gesture_required = {
        "animation-frame pinch updates": "schedulePinchZoom()",
        "unsnapped live pinch": "snap: false",
        "moving pinch midpoint": "fromAnchor: pending.fromAnchor",
        "double-tap focal zoom": "reader.setZoom?.(target, { clientX, clientY })",
    }
    gesture_forbidden = {
        "legacy zoom monkey patch": "installAnchoredZoom",
        "setZoom replacement": "reader.setZoom =",
        "applyTransform replacement": "reader.applyTransform =",
        "temporary pinch preview transform": "previewRatio = this.targetZoom",
        "split live-paged pinch path": "livePagedPinch",
    }
    preference_required = {
        "v0.16.1 desktop bottom pill": ".advancedBooksReaderChromeBottom{left:50%;right:auto;width:min(58rem,calc(100vw - 1.5rem))",
        "v0.16.1 idle page pill": ".advancedBooksReaderOverlay.ab-controls-hidden:not(.ab-settings-open) .advancedBooksReaderChromeBottom{opacity:.92",
        "v0.16.1 mobile floating chrome": ".advancedBooksReaderChrome{left:.45rem;right:.45rem;",
        "v0.16.1 mobile More button": ".advancedBooksReaderMoreButton{display:inline-flex}",
        "v0.16.1 More attachment": "attachMoreMenu(session);",
        "post-Core stylesheet reorder": "document.head.appendChild(existing);",
    }

    failures: list[str] = []
    for label, needle in required.items():
        if needle not in text:
            failures.append(f"missing {label}: {needle!r}")

    for label, needle in forbidden.items():
        if needle in text:
            failures.append(f"forbidden {label}: {needle!r}")

    for label, needle in integration_required.items():
        if needle not in integration:
            failures.append(f"missing integration {label}: {needle!r}")

    for label, needle in integration_forbidden.items():
        if needle in integration:
            failures.append(f"forbidden integration {label}: {needle!r}")

    for label, needle in zoom_required.items():
        if needle not in zoom:
            failures.append(f"missing zoom {label}: {needle!r}")

    for label, needle in gesture_required.items():
        if needle not in gestures:
            failures.append(f"missing gesture {label}: {needle!r}")

    for label, needle in gesture_forbidden.items():
        if needle in gestures:
            failures.append(f"forbidden gesture {label}: {needle!r}")

    for label, needle in preference_required.items():
        if needle not in preferences:
            failures.append(f"missing v0.16.1 UI {label}: {needle!r}")

    overlay_wait = preferences.find("const overlay = await waitFor('.advancedBooksReaderOverlay'")
    reorder = preferences.find("ensureHelpStyles();", overlay_wait)
    progress_wait = preferences.find("await waitForProgressReady(overlay);", overlay_wait)
    if not (overlay_wait >= 0 and reorder > overlay_wait and progress_wait > reorder):
        failures.append("v0.16.1 stylesheet is not reordered after Core and before progress restoration")

    if "stageHeight * this.zoom" not in text or "image.style.maxHeight" not in text:
        failures.append("continuous Fit Screen height does not scale with Reader zoom")
    if "this.clampPagedPan();" not in text:
        failures.append("paged drag/zoom does not use the Core-owned pan clamp")
    if "this.syncTouchAction();" not in text or "pan-x pan-y" not in text:
        failures.append("Reader does not resync touch-action for touch-gesture changes")

    zoom_registration = registration.find("jellyfin-advanced-books-reader-zoom")
    core_registration = registration.find("jellyfin-advanced-books-reader-core")
    if not (zoom_registration >= 0 and core_registration > zoom_registration):
        failures.append("required zoom geometry script is not registered before Reader Core")

    if failures:
        for failure in failures:
            print(f"ERROR: {failure}")
        return 1

    print("Reader render invariants validated.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
