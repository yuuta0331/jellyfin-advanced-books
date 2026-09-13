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
INTEGRATION = ROOT / "src/Jellyfin.Plugin.AdvancedBooks/Reader/advancedBooksIntegration.js"

LOCALES = ("en", "ja", "de", "fr", "es", "zh-CN")
REQUIRED_READER_KEYS = (
    "Advanced Reader",
    "Pages",
    "Reader settings",
    "More options",
    "Reader language",
    "Reading",
    "Appearance",
    "Behavior",
    "Language",
    "Automatic (Jellyfin)",
    "Single page",
    "Double page",
    "Vertical continuous",
    "Webtoon",
    "Previous page",
    "Next page",
    "Zoom in",
    "Zoom out",
    "Double tap",
    "Zoom tapped area / restore",
    "Left / right tap",
    "Top / bottom tap",
    "Previous / next page in Vertical / Webtoon",
    "Mouse drag",
    "Grab and pan the page / continuous canvas",
    "Metadata",
    "Title",
    "Authors",
    "Series",
    "Issue / number",
    "Year",
    "Auto-scroll",
    "Loading preview…",
    "Vertical and Webtoon keep native one-finger scrolling. Use Side padding and Page gap to tune continuous layouts; reader zoom remains available in every mode.",
)
REQUIRED_CONFIG_KEYS = (
    "readerHeading",
    "enableReader",
    "enableReaderDescription",
    "replaceNativeReader",
    "replaceNativeReaderDescription",
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
    integration = INTEGRATION.read_text(encoding="utf-8")

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
    require("setLocale" in reader and "languagePreference" in reader,
            "Reader localization has no persisted language override bridge")
    require("dataset.abAction" in reader, "Localization bridge does not annotate stable reader actions")
    require('button[data-ab-action="settings"]' in preferences,
            "Preferences still depends only on localized Reader settings title")
    require('button[data-ab-action="zoom-reset"]' in preferences,
            "Preferences still depends only on localized zoom title")
    require("language.dataset.abControl = 'language'" in preferences,
            "Reader preferences do not expose the language selector")
    require("AdvancedBooksI18n?.setLocale" in preferences,
            "Reader preferences do not apply language changes live")
    require("advancedBooksReaderSettingsSections" in preferences,
            "Reader settings are not organized into sections")
    require("document.createElement('details')" in preferences
            and "document.createElement('summary')" in preferences,
            "Reader settings sections are not collapsible")
    require("advancedBooksReaderMoreMenu" in preferences
            and "advancedBooksReaderMoreSource" in preferences,
            "Mobile secondary reader actions are not grouped into an overflow menu")
    require("session.openHelp" in preferences and "fullscreenButton?.click()" in preferences,
            "Overflow menu does not reuse the existing Help/Fullscreen actions")
    require('button[data-ab-action="zoom-reset"]' in gestures,
            "Gestures still depends only on localized zoom title")
    require("installAnchoredZoom" in gestures and "normalizeAnchor" in gestures,
            "Reader zoom is not anchored to the user focal point")
    require("doubleTapDelayMs" in gestures and "handleDoubleTap" in gestures,
            "Touch gestures do not provide double-tap zoom")
    require("touchPan" in gestures and "stage.scrollLeft" in gestures and "stage.scrollTop" in gestures,
            "Zoomed continuous layouts do not provide one-finger touch panning")
    require("advancedBooksReaderOverlay.ab-controls-hidden" in preferences
            and "advancedBooksReaderPageSliderValue" in preferences,
            "Reader bottom controls do not collapse to the compact page-position state")
    require("navigateHorizontal" in gestures and "navigateVertical" in gestures,
            "Gestures do not provide layout-aware horizontal/vertical tap navigation")
    require("behavior: 'smooth'" not in gestures
            or "goTo?.(target" in gestures,
            "Vertical/Webtoon tap navigation is not connected to smooth reader movement")
    require("advancedBooksPageFromLeft" in gestures and "advancedBooksPageFromRight" in gestures,
            "Paged tap navigation has no directional transition animation")
    require("handleMousePointerDown" in gestures and "scrollPan" in gestures,
            "Desktop grab-to-pan handling is missing")
    require("advancedBooksReaderTitle" in reader and "return;" in reader,
            "Localization bridge no longer protects the user-provided title row")
    require("advancedBooksNavigatorCard" in reader,
            "Localization bridge no longer protects navigator page filenames")
    require("value.split(' · ')" in reader,
            "Metadata localization must translate only structured metadata segments")
    require("history.pushState" in integration and "popstate" in integration,
            "Reader integration does not provide browser/mobile back navigation")
    require("btnPlay" in integration and "btnReplay" in integration,
            "Reader integration does not bridge Jellyfin Resume/Start actions")
    require("advancedBooksStartMode" in integration,
            "Native Jellyfin actions do not preserve resume/start-over semantics")
    require("createElementNS" in integration and "advancedBooksReaderNavButton" in integration,
            "Reader navigation still lacks stable SVG icon replacement")

    print("Validated Advanced Books localization: " + ", ".join(LOCALES))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
