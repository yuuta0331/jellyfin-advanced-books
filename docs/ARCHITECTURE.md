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
- archive safety policy/validation; and
- `ReaderProgressMath` for Jellyfin-compatible comic page/tick conversion.

### `Jellyfin.Plugin.AdvancedBooks`

The Jellyfin server plugin contains these integration layers:

- `OneShotBookResolver`, registered with `ResolverPriority.Plugin`, for Komga-style library semantics;
- `AdvancedBooksController` for authenticated page metadata and page streaming;
- `ReaderProgressController` for authenticated per-user reading progress;
- `JavaScriptInjectorRegistrationService` for optional Jellyfin Web script registration;
- `Reader/advancedBooksReader.js` for the reader UI; and
- `Reader/advancedBooksProgress.js` for resume/persistence integration.

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

## Security requirements for reader APIs

Reader endpoints never accept a raw media path from the client. They resolve a Jellyfin item ID and verify the current user can see that Book. API-key-only requests with no Jellyfin user context are not allowed to use the reader endpoints.

ZIP validation currently enforces:

- maximum archive entry count;
- maximum image-page count;
- maximum uncompressed bytes per page;
- maximum combined uncompressed image bytes;
- maximum per-page compression ratio;
- rejection of NUL, absolute and `..` traversal entry paths; and
- an allow-list of browser-readable image extensions/content types.

Pages are streamed from the ZIP entry. The whole CBZ is not downloaded into memory and files are not extracted to temporary directories. Streaming also stops at the validated uncompressed page length; a malformed entry that produces additional output cannot cause an unbounded decompression stream.

## Web reader

The reader is an embedded JavaScript module that renders a full-window overlay inside Jellyfin Web. It supports Single Page, Double Page, Vertical Continuous and Webtoon layouts, plus fit modes, RTL/LTR navigation, paged zoom/pan and multiple navigation inputs.

The reader never puts an authenticated page endpoint directly into an `<img src>`. Instead it uses Jellyfin's authenticated `ApiClient.fetch(...)`, converts each response to a temporary Blob URL, and gives only that local Blob URL to the image element.

Paged and continuous modes use bounded Blob caches. Continuous mode additionally uses `IntersectionObserver` for lazy loading and current-page tracking.

### Progress bridge

`advancedBooksProgress.js` is intentionally separate from the core reader module. It observes the reader's public DOM state, debounces progress writes, flushes on close, and restores unfinished books from the server-side progress endpoint.

For a distant resume position it temporarily uses the continuous page-slot model to jump directly to the saved page, then restores the prior layout. This avoids performing hundreds of sequential page-navigation operations.

Keeping persistence in a separate bridge means the archive API and reader rendering can evolve independently, while the bridge can later be replaced by a first-class Jellyfin Web media-player integration.

### Replaceable Jellyfin Web adapter

Jellyfin does not currently expose a stable general-purpose server-plugin API for replacing arbitrary Web UI components. Web integration is therefore kept replaceable.

For the Jellyfin 12 preview, `JavaScriptInjectorRegistrationService` discovers the community JavaScript Injector assembly at runtime and calls its public registration contract by reflection. Advanced Books does not reference or ship JavaScript Injector or Newtonsoft.Json assemblies. The reader and progress resources are concatenated into a single registered injection payload so their load order is deterministic.

If Jellyfin changes its item-detail route, `.mainDetailButtons` container, reader DOM or legacy `window.ApiClient`, only the Web adapter/bridge should require changes; archive and library code remain independent.

See [Advanced Reader](READER.md) for controls and current compatibility.

## Compatibility target

The current target is Jellyfin Server 12.0.x / .NET 10. Compatibility with later Jellyfin 12 minors will be validated in CI and release testing before being claimed.
