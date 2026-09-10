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
- `Reader/advancedBooksGestures.js` for isolated multi-touch/pinch handling.

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

The metadata response intentionally excludes the server media path. It contains archive format, file size, last-modified time and ordered page metadata. Page ordering is natural and case-insensitive for text portions, so `page2.jpg` precedes `page10.jpg`. Non-image metadata such as `ComicInfo.xml` is ignored by the page list.

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

Persisted values are layout, direction, fit and zoom. Server-side `ReaderPreferenceRules` rejects unsupported values, bounds zoom to 50%-400%, and normalizes it to a 5-percent grid reachable by the current reader controls. Unknown/stale stored values fall back to safe defaults during GET.

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

Paged and continuous modes use bounded Blob caches. Continuous mode additionally uses `IntersectionObserver` for lazy loading and current-page tracking.

### Progress bridge

`advancedBooksProgress.js` is intentionally separate from the core reader module. It observes the reader's public DOM state, debounces progress writes, flushes on close, restores unfinished books from the server-side progress endpoint, and signals when resume handling is complete.

For a distant resume position it temporarily uses the continuous page-slot model to jump directly to the saved page, then restores the initial layout. This avoids performing hundreds of sequential page-navigation operations.

### Preferences bridge

`advancedBooksPreferences.js` reads global per-user settings while the reader opens, waits for the progress-ready signal, and then applies the saved controls. It observes select changes and the visible zoom percentage, debounces updates, and serializes saves so the latest user state wins.

The bridge intentionally talks only to the Advanced Books preferences API; it does not call Jellyfin's general display-preferences HTTP controller or expose the internal pseudo-item namespace to the browser.

### Thumbnail navigator

`advancedBooksNavigator.js` attaches to an active reader overlay and adds the **Pages** toolbar button. It creates lightweight cards for the document but loads thumbnail bytes only when cards enter an expanded navigator viewport. Closing the navigator aborts outstanding thumbnail requests, and Blob URLs are bounded/revoked.

Selecting a thumbnail reuses the continuous page-slot model to reach a distant page. The bridge waits until the reader's page counter confirms the target before restoring the prior layout, avoiding timing-dependent jumps on slower devices.

### Touch gesture bridge

`advancedBooksGestures.js` owns two-finger pinch handling for paged layouts without introducing a second reader zoom state. It observes the active reader overlay and listens to touch Pointer Events in capture phase. The first touch is left to the base reader; from the second touch onward, the bridge isolates the multi-touch gesture from the base reader's single-pointer swipe/pan state.

A pinch locks the original two pointer IDs. Extra fingers are suppressed rather than becoming replacement pinch pointers, and ending either original pointer ends the pinch. This prevents a third finger or pointer-order change from causing a sudden zoom jump. Final pointer-up events remain suppressed until all tracked touches are released so a completed pinch cannot become an accidental page turn.

While pinching, the bridge applies a temporary visual scale/translation preview derived from finger distance and midpoint. On release it restores the reader-owned transform and commits the normalized 5-percent zoom through the existing Reset/Zoom/Ctrl+wheel controls. The toolbar percentage and preference bridge therefore observe the same committed state as keyboard, mouse and button zoom operations.

The bridge deliberately leaves Vertical Continuous and Webtoon to native vertical touch scrolling. It also does not globally force `touch-action:none` for paged modes, because Fit Width or Original content may still need vertical panning at or below 100% zoom. Focal-point pan is currently preview-only; a meaningful committed zoom recenters according to the base reader's normal transform.

### Replaceable Jellyfin Web adapter

Jellyfin does not currently expose a stable general-purpose server-plugin API for replacing arbitrary Web UI components. Web integration is therefore kept replaceable.

For the Jellyfin 12 preview, `JavaScriptInjectorRegistrationService` discovers the community JavaScript Injector assembly at runtime and calls its public registration contract by reflection. Advanced Books does not reference or ship JavaScript Injector or Newtonsoft.Json assemblies. The reader, progress, preferences, navigator and gesture resources are concatenated into a single registered injection payload so their load order is deterministic.

If Jellyfin changes its item-detail route, `.mainDetailButtons` container, reader DOM, pointer-event/touch-action behavior or legacy `window.ApiClient`, only the Web adapter/bridges should require changes; archive and storage code remain independent.

See [Advanced Reader](READER.md) and [Pinch Zoom](PINCH_ZOOM.md) for controls and current compatibility.

## Compatibility target

The current target is Jellyfin Server 12.0.x / .NET 10. Compatibility with later Jellyfin 12 minors will be validated in CI and release testing before being claimed.
