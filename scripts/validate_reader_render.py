#!/usr/bin/env python3
"""Validate source-level Advanced Reader render invariants that prevent duplicate pages."""

from pathlib import Path

READER = Path("src/Jellyfin.Plugin.AdvancedBooks/Reader/advancedBooksReader.js")
INTEGRATION = Path("src/Jellyfin.Plugin.AdvancedBooks/Reader/advancedBooksIntegration.js")


def main() -> int:
    text = READER.read_text(encoding="utf-8")
    integration = INTEGRATION.read_text(encoding="utf-8")

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

    if failures:
        for failure in failures:
            print(f"ERROR: {failure}")
        return 1

    print("Reader render invariants validated.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
