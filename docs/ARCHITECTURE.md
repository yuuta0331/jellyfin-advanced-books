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

The Jellyfin server plugin. `PluginServiceRegistrator` registers `OneShotBookResolver` as an
`IItemResolver` and the archive reader as a singleton service. The resolver uses
`ResolverPriority.Plugin`, Jellyfin's highest resolver priority intended for plugin overrides.

Only items in a Jellyfin Books library are considered by the One-Shot resolver. Normal book paths are
left to Jellyfin's built-in resolver.

`AdvancedBooksController` exposes the reader API. It resolves media from a Jellyfin Book item ID,
requires an authenticated Jellyfin user, and verifies `Book.IsVisible(user)` before the filesystem
path can reach the archive reader.

## Komga One-Shot mapping

Komga represents a One-Shot as a series containing one book. Jellyfin's book model is different, so
the initial mapping is deliberately conservative:

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

The first reader backend targets CBZ/ZIP because entries can be independently streamed without
extracting the archive to disk.

Endpoints:

```text
GET /AdvancedBooks/Books/{itemId}/Pages
GET /AdvancedBooks/Books/{itemId}/Pages/{pageIndex}
```

The metadata response intentionally excludes the server media path. It contains archive format, file
size, last-modified time and ordered page metadata (index, archive entry name, uncompressed/compressed
length and content type).

Page ordering is natural and case-insensitive for text portions, so `page2.jpg` precedes
`page10.jpg`. Non-image metadata such as `ComicInfo.xml` is ignored by the page list.

The first implementation re-opens and validates the archive for each page request. This is deliberate:
it keeps resource ownership simple and bounded while the behavior is validated. A bounded metadata
cache/prefetch layer can be added later without changing the external API.

## Security requirements for page APIs

Reader endpoints never accept a raw media path from the client. They resolve a Jellyfin item ID and
verify the current user can see that Book. API-key-only requests with no Jellyfin user context are not
allowed to use the reader endpoint.

ZIP validation currently enforces:

- maximum archive entry count;
- maximum image-page count;
- maximum uncompressed bytes per page;
- maximum combined uncompressed image bytes;
- maximum per-page compression ratio;
- rejection of NUL, absolute and `..` traversal entry paths; and
- an allow-list of browser-readable image extensions/content types.

Pages are streamed from the ZIP entry. The whole CBZ is not downloaded into memory and files are not
extracted to temporary directories. Streaming also stops at the validated uncompressed page length;
a malformed entry that produces additional output cannot cause an unbounded decompression stream.

## Web reader

The custom reader remains isolated from library/scanner logic. This is important because Jellyfin does
not currently expose a stable general-purpose Web UI plugin API; the Web integration layer therefore
must remain replaceable and be tested against each supported Jellyfin Web release.

Planned modes:

- single page and double page;
- left-to-right and right-to-left navigation;
- fit width, fit height, fit screen and original size;
- mouse/touch zoom and pan;
- continuous vertical reading;
- webtoon-style continuous reading;
- lazy loading and configurable prefetch;
- keyboard, click/tap, wheel and swipe navigation;
- reading-position synchronization through Jellyfin.

## Compatibility target

The current target is Jellyfin Server 12.0.x / .NET 10. Compatibility with later Jellyfin 12 minors
will be validated in CI and release testing before being claimed.
