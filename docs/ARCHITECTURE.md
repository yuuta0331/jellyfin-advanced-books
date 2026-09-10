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

Host-independent logic that can be unit tested without a running Jellyfin server. The first component is
`KomgaOneShotPathMatcher`, which models Komga's One-Shots directory matching behavior.

### `Jellyfin.Plugin.AdvancedBooks`

The Jellyfin server plugin. `PluginServiceRegistrator` registers `OneShotBookResolver` as an
`IItemResolver`. The resolver uses `ResolverPriority.Plugin`, which is Jellyfin's highest resolver
priority and is intended for plugins that must override default server resolvers.

Only items in a Jellyfin Books library are considered. Normal book paths are left to Jellyfin's
built-in resolver.

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

## Planned reader architecture

The advanced reader will be implemented separately from the library resolver.

### Server-side page service

A future API layer will expose pages by Jellyfin item ID rather than arbitrary filesystem paths. The
service will:

- validate that the item belongs to a readable Books library;
- enumerate archive entries safely;
- expose page metadata separately from page bytes;
- stream individual pages on demand;
- enforce archive-entry and decompression limits;
- support bounded caching and prefetching.

CBZ/ZIP is the first target. CBR, PDF and EPUB will be added only after the archive pipeline is stable.

### Web reader

The reader will be an isolated web module so that Jellyfin Web integration can change without
coupling the server-side page service to undocumented UI details.

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

Because Jellyfin currently has no stable general-purpose Web UI plugin API, the integration layer must
be treated as replaceable and tested against each supported Jellyfin Web release.

## Security requirements for page APIs

Reader endpoints must never accept a raw media path from the client. They must resolve a Jellyfin item
ID server-side and reject entries that escape the media archive or configured library.

Archive handling must defend against:

- path traversal / zip-slip;
- decompression bombs;
- excessive entry counts;
- unsupported or misleading file extensions;
- unbounded memory buffering.

## Compatibility target

The initial target is Jellyfin Server 12.0.x / .NET 10. Compatibility with later Jellyfin 12 minors
will be validated in CI and release testing before being claimed.
