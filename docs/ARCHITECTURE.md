# Architecture

This document describes the implementation boundaries for Jellyfin Advanced Books.

## Goals

The project has two related goals:

1. make Jellyfin 12 understand common comic/manga library layouts without reorganizing the user's files; and
2. provide a comic reader that approaches dedicated servers such as Komga while keeping Jellyfin as the media hub.

The plugin must not rewrite or move source media as part of normal scanning.

## Current architecture

The repository is split into two assemblies.

### `Jellyfin.AdvancedBooks.Core`

Host-independent logic that can be unit tested without a running Jellyfin server. It contains:

- `KomgaOneShotPathMatcher` for Komga-compatible One-Shot path semantics;
- `ZipBookArchiveReader` for safe CBZ/ZIP image-page enumeration and streaming;
- natural filename ordering;
- archive safety policy/validation;
- `ReaderProgressMath` for Jellyfin-compatible comic page/tick conversion; and
- `ReaderPreferenceRules` for host-independent reader preference validation/defaults.

### `Jellyfin.Plugin.AdvancedBooks`

The Jellyfin server plugin contains these integration layers:

- `OneShotBookResolver`, registered with `ResolverPriority.Plugin`, for Komga-style library semantics;
- `AdvancedBooksController` for authenticated page metadata and page streaming;
- `ReaderThumbnailController` plus `ReaderThumbnailService` for bounded page thumbnails;
- `ReaderProgressController` for authenticated per-user reading progress;
- `ReaderPreferencesController` for authenticated global per-user reader controls;
- `JavaScriptInjectorRegistrationService` for optional Jellyfin Web script registration;
- `Reader/advancedBooksReader.js` for the reader UI;
- `Reader/advancedBooksProgress.js` for resume/persistence integration;
- `Reader/advancedBooksPreferences.js` for display-preference synchronization;
- `Reader/advancedBooksNavigator.js` for the lazy thumbnail page navigator; and
- `Reader/advancedBooksGestures.js` for isolated paged multi-touch handling.

Only items in a Jellyfin Books library are considered by the One-Shot resolver. Normal book paths are left to Jellyfin's built-in resolver.

## Komga One-Shot mapping

Komga represents a One-Shot as a series containing one book. Jellyfin's book model is different, so the initial mapping is deliberately conservative:

- a matching book is resolved before Jellyfin's default `BookResolver`;
- its file remains the media source;
- index defaults to `1` when the filename does not provide one;
- by default the book title is also used as the series name;
- users can instead preserve a filename-parsed series or assign no series name.

The matcher supports the two behaviors documented by Komga:

- `_oneshots`: match the configured text anywhere in the directory path;
- `/_oneshots`: match directory segments that start with `_oneshots`.

This is a compatibility mapping, not yet a full emulation of Komga's dedicated `oneshot` entity flag.

## Server-side page service

The first reader backend targets CBZ/ZIP because entries can be independently streamed without extracting the archive to disk.

```text
GET /AdvancedBooks/Books/{itemId}/Pages
GET /AdvancedBooks/Books/{itemId}/Pages/{pageIndex}
```

The metadata response intentionally excludes the server media path. It contains archive format, file size, last-modified time, ordered page metadata, and reader-safe Jellyfin metadata (title, original title, series/issue, year and authors). Page ordering is natural and case-insensitive for text portions, so `page2.jpg` precedes `page10.jpg`. Non-image metadata such as `ComicInfo.xml` is ignored, and image-looking macOS metadata (`__MACOSX` and AppleDouble `._*` entries) is excluded before page indexes are assigned.

The server currently re-opens and validates the archive for each page request. This keeps resource ownership simple and bounded while real-world behavior is validated. Reader-side nearby-page prefetch and Blob caching hide much of that latency without changing the external API.

## Thumbnail service

The page navigator uses a separate authenticated endpoint:

```text
GET /AdvancedBooks/Books/{itemId}/Pages/{pageIndex}/Thumbnail?width=180
```

Requests accept widths between 96 and 320 pixels, but the server normalizes them downward into five cache widths: 96, 128, 180, 240 and 320. This prevents an authenticated client from creating hundreds of cache variants for every page.

`ReaderThumbnailService` opens the already validated archive page, writes only that page to a temporary plugin work file, and asks Jellyfin's `IImageProcessor` to resize it. Only WebP, JPEG and PNG are accepted as generated thumbnail formats. The resized result is copied into the plugin-owned cache and both the full-resolution work file and Jellyfin image-processor intermediate are deleted afterward.

Thumbnail generation is globally limited to two concurrent operations. The persistent key includes the archive size/last-modified time, page identity, compressed/uncompressed sizes and normalized width. When the same page/width is regenerated for a changed archive, superseded plugin-cache variants for that page are removed.

## Reading-progress service

Progress uses Jellyfin's normal per-user `UserItemData` rather than a plugin-owned database:

```text
GET /AdvancedBooks/Books/{itemId}/Progress
PUT /AdvancedBooks/Books/{itemId}/Progress
```

The mapping deliberately matches Jellyfin Web's built-in ComicsPlayer:

```text
PlaybackPositionTicks = zeroBasedPageIndex * 10,000
```

That allows the built-in and Advanced readers to interpret the same stored resume position. Progress writes update `PlaybackPositionTicks` and `LastPlayedDate`. Reaching the final page additionally sets `Played=true` and uses `UserDataSaveReason.PlaybackFinished`; intermediate saves use `PlaybackProgress` and do not force `Played=false`, preserving completed state during rereads.

The server validates a submitted page index against the archive's current page count before saving it. Progress is therefore associated with a real page in the accessible Book rather than trusting client-supplied range metadata.

## Reader preference service

Reader controls use Jellyfin's `IDisplayPreferencesManager`, not a plugin-owned settings file:

```text
GET /AdvancedBooks/Reader/Preferences
PUT /AdvancedBooks/Reader/Preferences
```

A fixed Advanced Books pseudo-item GUID plus client namespace `AdvancedBooksReader` isolates the custom preference keys from normal Jellyfin display settings. The display-preference manager keys the data by the authenticated Jellyfin user, so preferences are shared across Jellyfin Web clients for that user while remaining separate between users.

Persisted values are layout, direction, fit, zoom, continuous side padding/page gap, background, transition animation, touch-gesture state, metadata header/field visibility and metadata auto-scroll. Server-side `ReaderPreferenceRules` rejects unsupported enum-like values, bounds zoom to 50%-400%, and normalizes it to a 5-percent grid reachable by the current reader controls. Unknown/stale stored values fall back to safe defaults during GET.

The Web preference bridge waits until reading-position restore has finished before applying controls. The progress bridge marks the active overlay and emits `advancedbooks:progress-ready`; the preference bridge listens for that signal with a bounded timeout. This ordering keeps the temporary continuous-mode resume jump separate from the user's persisted layout.

Preference writes are debounced. If a new value arrives while a save is in flight, only the newest pending state is retained and sent after the current PUT. Closing the reader captures and attempts to flush the final pending state without creating an automatic retry loop after a server failure.

## Security requirements for reader APIs

Reader endpoints never accept a raw media path from the client. Page/progress/thumbnail endpoints resolve a Jellyfin item ID and verify the current user can see that Book. Preference endpoints operate only on the current authenticated user and do not accept an arbitrary user id. API-key-only requests with no Jellyfin user context are not allowed to use these endpoints.

ZIP validation currently enforces:

- maximum archive entry count;
- maximum image-page count;
- maximum uncompressed bytes per page;
- maximum combined uncompressed image bytes;
- maximum per-page compression ratio;
- rejection of NUL, absolute and `..` traversal entry paths; and
- an allow-list of browser-readable image extensions/content types.

Normal reader pages are streamed from the ZIP entry and are never extracted to a permanent location. Thumbnail generation is the one intentional temporary extraction path: it writes a single already-validated page to the plugin work directory solely for Jellyfin image resizing, then removes it immediately.

## Web reader

The reader is an embedded JavaScript module that renders a full-window overlay inside Jellyfin Web. It supports Single Page, Double Page, Vertical Continuous and Webtoon layouts, plus fit modes, RTL/LTR navigation, paged zoom/pan and multiple navigation inputs.

The reader never puts an authenticated page endpoint directly into an `<img src>`. Instead it uses Jellyfin's authenticated `ApiClient.fetch(...)`, converts each response to a temporary Blob URL, and gives only that local Blob URL to the image element.

Paged and continuous modes use bounded Blob caches. Double Page resolves the orientation of the current/next page before committing a spread, avoiding an initial guessed spread followed by a layout correction. Continuous mode additionally uses `IntersectionObserver` for lazy loading and current-page tracking. A Continuous/Webtoon slot may contain exactly one placeholder or one page image: all successful loads use replacement semantics, and a slot generation value invalidates stale asynchronous completions after eviction/reset. This is the primary defense against duplicate images caused by overlapping initial load, observer and prefetch paths.

### Localization bridge

`advancedBooksLocalization.js` detects the Jellyfin document locale with a browser-language fallback and translates only Advanced Books-owned UI. Translation dictionaries currently cover English, Japanese, German, French, Spanish and Simplified Chinese. User-provided title/author/series text is not passed through the static UI-label translator; only Advanced Books metadata prefixes are localized. The bridge also annotates translated controls with stable `data-ab-action` identifiers so internal integrations never depend on localized tooltip text.

### Progress bridge

`advancedBooksProgress.js` is intentionally separate from the core reader module. It observes the reader's public DOM state, debounces progress writes, captures the final position from the reader's pre-removal close event, queues the newest position behind an in-flight PUT, restores any non-zero saved position even for already-played books, and signals when resume handling is complete.

For a distant resume position it calls the live reader session directly, avoiding hundreds of sequential page-navigation operations or a temporary layout switch.

### Preferences bridge

`advancedBooksPreferences.js` reads global per-user settings while the reader opens, waits for the progress-ready signal, and then applies the saved controls. It observes select changes and the visible zoom percentage, debounces updates, serializes saves so the latest user state wins, hosts the lightweight contextual help UI, and owns configurable metadata rendering/marquee behavior so the Core injector payload stays below its size limit.

The bridge intentionally talks only to the Advanced Books preferences API; it does not call Jellyfin's general display-preferences HTTP controller or expose the internal pseudo-item namespace to the browser.

### Thumbnail navigator

`advancedBooksNavigator.js` attaches to an active reader overlay and adds the **Pages** toolbar button. It creates lightweight cards for the document but loads thumbnail bytes only when cards enter an expanded navigator viewport. Closing the navigator aborts outstanding thumbnail requests, and Blob URLs are bounded/revoked.

Selecting a thumbnail reuses the continuous page-slot model to reach a distant page. The bridge waits until the reader's page counter confirms the target before restoring the prior layout, avoiding timing-dependent jumps on slower devices.

### Touch gesture bridge

`advancedBooksGestures.js` owns two-finger pinch handling across paged and continuous layouts. It tracks the original pinch pair, isolates multi-touch pointer events from the base reader's one-finger tap/swipe/pan state, respects the persisted touch-gesture toggle, renders only a temporary gesture preview, then commits a normalized zoom through the live reader session.

### Replaceable Jellyfin Web adapter

Jellyfin does not currently expose a stable general-purpose server-plugin API for replacing arbitrary Web UI components. Web integration is therefore kept replaceable.

For the Jellyfin 12 preview, `JavaScriptInjectorRegistrationService` discovers the community JavaScript Injector assembly at runtime and calls its public registration contract by reflection. Advanced Books does not reference or ship JavaScript Injector or Newtonsoft.Json assemblies. Localization, Core, Progress, Preferences, Navigator and Gestures are registered as six independent entries; Core is required while optional bridges fail soft, and each embedded resource is validated before registration.

Full-page responses use `Cache-Control: private, no-store` and include `X-AdvancedBooks-Page-Index`; the browser includes an archive-version query key and verifies the returned index before caching the page Blob. If Jellyfin changes its item-detail route, `.mainDetailButtons` container, reader DOM or legacy `window.ApiClient`, only the Web adapter/bridges should require changes; archive and storage code remain independent.

## Distribution boundary

Release artifacts are generated separately from the runtime/plugin implementation. `scripts/package_plugin.py` packages only the two runtime assemblies at ZIP root with normalized archive metadata and emits MD5/SHA-256 checksums. CI packages the same build twice and compares the outputs byte-for-byte so nondeterministic packaging fails before merge.

`manifest.json` is generated by `scripts/update_manifest.py`. The release workflow does not trust a pre-release local checksum: after GitHub publishes or resolves the versioned release, it downloads the published ZIP and calculates the manifest MD5 from those exact bytes. The manifest timestamp is the GitHub Release `publishedAt` value, making reconstruction idempotent across reruns.

Release publishing is intentionally independent from repository visibility. A private repository can produce verified GitHub release artifacts for manual installation, but Jellyfin's normal repository downloader needs anonymously reachable HTTPS manifest and package URLs. Changing repository visibility is therefore an operational decision outside the release workflow.

See [Advanced Reader](READER.md) for controls and current compatibility.

## Compatibility target

The current target is Jellyfin Server 12.0.x / .NET 10. Compatibility with later Jellyfin 12 minors will be validated in CI and release testing before being claimed.
