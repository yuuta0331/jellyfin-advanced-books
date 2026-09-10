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
- natural filename ordering; and
- archive safety policy/validation.

### `Jellyfin.Plugin.AdvancedBooks`

The Jellyfin server plugin contains four integration layers:

- `OneShotBookResolver`, registered with `ResolverPriority.Plugin`, for Komga-style library semantics;
- `AdvancedBooksController` for authenticated page metadata and page streaming;
- `JavaScriptInjectorRegistrationService` for optional Jellyfin Web script registration; and
- the embedded `Reader/advancedBooksReader.js` client module.

Only items in a Jellyfin Books library are considered by the One-Shot resolver. Normal book paths are left to Jellyfin's built-in resolver.

`AdvancedBooksController` resolves media from a Jellyfin Book item ID, requires an authenticated Jellyfin user, and verifies `Book.IsVisible(user)` before the filesystem path can reach the archive reader.

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

Endpoints:

```text
GET /AdvancedBooks/Books/{itemId}/Pages
GET /AdvancedBooks/Books/{itemId}/Pages/{pageIndex}
```

The metadata response intentionally excludes the server media path. It contains archive format, file size, last-modified time and ordered page metadata. Page ordering is natural and case-insensitive for text portions, so `page2.jpg` precedes `page10.jpg`. Non-image metadata such as `ComicInfo.xml` is ignored by the page list.

The server currently re-opens and validates the archive for each page request. This keeps resource ownership simple and bounded while real-world behavior is validated. Reader-side nearby-page prefetch and Blob caching hide much of that latency without changing the external API.

## Security requirements for page APIs

Reader endpoints never accept a raw media path from the client. They resolve a Jellyfin item ID and verify the current user can see that Book. API-key-only requests with no Jellyfin user context are not allowed to use the reader endpoint.

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

The reader is an embedded JavaScript module that renders a full-window overlay inside Jellyfin Web. It currently supports single/double layouts, RTL/LTR navigation, fit modes, zoom/pan and multiple navigation inputs.

The reader never puts an authenticated page endpoint directly into an `<img src>`. Instead it uses Jellyfin's authenticated `ApiClient.fetch(...)`, converts each response to a temporary Blob URL, and gives only that local Blob URL to the image element.

The client keeps at most eight Blob URLs and revokes them on eviction or reader close. Nearby pages are prefetched, while the complete CBZ is never downloaded by the reader.

### Replaceable Jellyfin Web adapter

Jellyfin does not currently expose a stable general-purpose server-plugin API for replacing arbitrary Web UI components. Web integration is therefore kept replaceable.

For the Jellyfin 12 preview, `JavaScriptInjectorRegistrationService` discovers the community JavaScript Injector assembly at runtime and calls its public registration contract by reflection. Advanced Books does not reference or ship JavaScript Injector or Newtonsoft.Json assemblies.

The injected module watches item-detail navigation, probes the Advanced Books page API, and only adds an **Advanced Reader** button when the current item is a supported, accessible archive-backed Book.

If Jellyfin changes its item-detail route, `.mainDetailButtons` container or legacy `window.ApiClient`, only the Web adapter should require changes; archive and library code remain independent.

See [Advanced Reader](READER.md) for controls and current compatibility.

## Compatibility target

The current target is Jellyfin Server 12.0.x / .NET 10. Compatibility with later Jellyfin 12 minors will be validated in CI and release testing before being claimed.
