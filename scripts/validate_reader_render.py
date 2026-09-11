#!/usr/bin/env python3
"""Validate source-level Advanced Reader render invariants that prevent duplicate pages."""

from pathlib import Path

READER = Path("src/Jellyfin.Plugin.AdvancedBooks/Reader/advancedBooksReader.js")


def main() -> int:
    text = READER.read_text(encoding="utf-8")

    required = {
        "continuous image replacement": "slot.replaceChildren(image)",
        "placeholder replacement": "slot.replaceChildren(placeholder)",
        "stale-load generation guard": "abLoadGeneration",
        "page identity response verification": "X-AdvancedBooks-Page-Index",
        "pre-render spread orientation probe": "ensurePageAspectRatio",
    }
    forbidden = {
        "append-based continuous page insertion": "slot.appendChild(image)",
        "legacy global spread realignment": "spreadStartFor(",
    }

    failures: list[str] = []
    for label, needle in required.items():
        if needle not in text:
            failures.append(f"missing {label}: {needle!r}")

    for label, needle in forbidden.items():
        if needle in text:
            failures.append(f"forbidden {label}: {needle!r}")

    if failures:
        for failure in failures:
            print(f"ERROR: {failure}")
        return 1

    print("Reader render invariants validated.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
