#!/usr/bin/env python3
"""Validate Advanced Books reader/config localization coverage and integration."""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
READER = ROOT / "src/Jellyfin.Plugin.AdvancedBooks/Reader/advancedBooksLocalization.js"
CONFIG = ROOT / "src/Jellyfin.Plugin.AdvancedBooks/Configuration/configPage.html"
PREFERENCES = ROOT / "src/Jellyfin.Plugin.AdvancedBooks/Reader/advancedBooksPreferences.js"
GESTURES = ROOT / "src/Jellyfin.Plugin.AdvancedBooks/Reader/advancedBooksGestures.js"

LOCALES = ("en", "ja", "de", "fr", "es", "zh-CN")
REQUIRED_READER_KEYS = (
    "Advanced Reader",
    "Pages",
    "Reader settings",
    "Single page",
    "Double page",
    "Vertical continuous",
    "Webtoon",
    "Previous page",
    "Next page",
    "Zoom in",
    "Zoom out",
    "Metadata",
    "Title",
    "Authors",
    "Series",
    "Issue / number",
    "Year",
    "Auto-scroll",
)
REQUIRED_CONFIG_KEYS = (
    "readerHeading",
    "enableReader",
    "enableReaderDescription",
    "komgaHeading",
    "enableOneShots",
    "oneShotDirectory",
    "caseSensitive",
    "seriesMode",
    "restartRescan",
    "save",
)


def extract_object(text: str, locale: str) -> str:
    token = re.escape(locale)
    key = rf"(?:'{token}'|{token})"
    inline = re.search(rf"^\s*{key}\s*:\s*\{{\s*\}}\s*,?\s*$", text, re.MULTILINE)
    if inline:
        return ""
    match = re.search(rf"^\s*{key}\s*:\s*\{{(.*?)^\s*\}}\s*,?\s*$", text, re.MULTILINE | re.DOTALL)
    if not match:
        raise ValueError(f"Missing locale block: {locale}")
    return match.group(1)


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def main() -> int:
    reader = READER.read_text(encoding="utf-8")
    config = CONFIG.read_text(encoding="utf-8")
    preferences = PREFERENCES.read_text(encoding="utf-8")
    gestures = GESTURES.read_text(encoding="utf-8")

    supported_literal = "['en', 'ja', 'de', 'fr', 'es', 'zh-CN']"
    require(supported_literal in reader, "Reader supportedLocales list is incomplete")

    for locale in LOCALES:
        extract_object(reader, locale)
        extract_object(config, locale)

    for locale in LOCALES[1:]:
        block = extract_object(reader, locale)
        for key in REQUIRED_READER_KEYS:
            require(f"'{key}':" in block, f"Reader locale {locale} is missing {key!r}")
        require(block.count(":") >= 70, f"Reader locale {locale} appears incomplete")

        config_block = extract_object(config, locale)
        for key in REQUIRED_CONFIG_KEYS:
            require(re.search(rf"\b{re.escape(key)}\s*:", config_block) is not None,
                    f"Config locale {locale} is missing {key!r}")
        require(config_block.count(":") >= 14, f"Config locale {locale} appears incomplete")

    require("document.documentElement.lang" in reader, "Reader locale does not follow Jellyfin document language")
    require("navigator.language" in reader, "Reader locale has no browser fallback")
    require("data-ab-action" in reader, "Localization bridge does not annotate stable reader actions")
    require('button[data-ab-action="settings"]' in preferences,
            "Preferences still depends only on localized Reader settings title")
    require('button[data-ab-action="zoom-reset"]' in preferences,
            "Preferences still depends only on localized zoom title")
    require('button[data-ab-action="zoom-reset"]' in gestures,
            "Gestures still depends only on localized zoom title")

    print("Validated Advanced Books localization: " + ", ".join(LOCALES))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
