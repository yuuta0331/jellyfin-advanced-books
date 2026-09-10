# Jellyfin Advanced Books

Advanced book, comic, manga and magazine support for **Jellyfin 12**.

> **Status: early development / not yet a stable release.**
> Komga-compatible One-Shot handling, safe CBZ/ZIP per-page delivery, paged/continuous Advanced Reader modes, and Jellyfin-backed reading progress are implemented.

## What this project is for

Jellyfin 12 significantly improves Books, but dedicated comic servers still provide stronger library semantics and reading controls. Jellyfin Advanced Books aims to close that gap without forcing users to reorganize an existing Komga library. Komga and Jellyfin can point at the same read-only media tree.

## Current features

- Jellyfin Server **12.0.x** / .NET 10 foundation.
- Komga-style `_oneshots` and `/_oneshots` matching.
- Configurable One-Shot series mapping.
- Authenticated CBZ/ZIP page metadata API.
- Per-page image streaming instead of whole-CBZ browser download/extraction.
- Natural page ordering (`page2` before `page10`).
- Archive entry/page/size/compression-ratio limits and traversal rejection.
- **Single Page** and **Double Page** reader modes.
- **Vertical Continuous** and **Webtoon** reader modes.
- RTL/LTR page navigation for paged modes.
- Fit Screen / Width / Height / Original sizing.
- 50%-400% paged zoom and drag-to-pan.
- Keyboard, click/tap, swipe and wheel controls.
- IntersectionObserver-based continuous lazy loading.
- Bounded page cache, nearby prefetch and distant-request cancellation.
- **Per-user reading position stored in Jellyfin user data.**
- **Automatic resume for unfinished books, including across Jellyfin Web clients.**
- Final-page completion marks the Jellyfin Book as played.
- Resume positions use Jellyfin's built-in ComicsPlayer page/tick convention.
- Optional automatic Jellyfin Web integration through a Jellyfin 12-compatible JavaScript Injector plugin.
- No source-file moves, renames or rewrites.

Example Komga-compatible layout:

```text
Books/
├── Space Adventures/
│   ├── Space Adventures v01.cbz
│   ├── Space Adventures v02.cbz
│   └── _oneshots/
│       └── Pluto Adventures.cbz
└── _oneshots/
    ├── A oneshot.cbz
    └── Another oneshot.cbz
```

## Advanced Reader (development preview)

The reader consumes individual pages through Advanced Books rather than downloading the complete CBZ into the browser.

Available modes are Single Page, Double Page, Vertical Continuous and Webtoon. Continuous modes place lightweight placeholders for the document but fetch image bytes only near the reader viewport. Distant pages are evicted from the Blob cache and can be loaded again when revisited.

Reading position is saved to Jellyfin's normal per-user item data after navigation settles and is flushed when the reader closes. Unfinished books reopen at the saved page. Reaching the final page marks the Book as played. Non-final progress updates do not clear an existing played state, so starting a reread does not silently mark a completed book unread.

To expose the **Advanced Reader** button inside Jellyfin Web today, install a Jellyfin 12-compatible build of the community **JavaScript Injector** plugin and restart Jellyfin. Advanced Books detects it at runtime and registers its embedded reader scripts; there is no compile-time dependency between the plugins.

See [Advanced Reader](docs/READER.md) for controls and implementation details.

## Reader API

```text
GET /AdvancedBooks/Books/{itemId}/Pages
GET /AdvancedBooks/Books/{itemId}/Pages/{pageIndex}
GET /AdvancedBooks/Books/{itemId}/Progress
PUT /AdvancedBooks/Books/{itemId}/Progress
```

Clients supply only a Jellyfin item ID; raw server filesystem paths are never accepted. Endpoints require an authenticated Jellyfin user and a Book visible to that user. Unsupported formats return HTTP 415; invalid or safety-rejected archives return HTTP 422.

Progress page indexes are validated against the server-side archive page count. Positions use `pageIndex * 10,000` playback ticks, matching Jellyfin Web's built-in ComicsPlayer convention so the standard and Advanced readers can share resume data.

The page API currently recognizes JPEG, PNG, WebP, GIF, BMP and AVIF image entries. CBR/PDF/EPUB Advanced Reader pipelines are deferred until the ZIP pipeline is proven stable.

## Still planned

Important next milestones are a thumbnail/page navigator, persisted per-user reader preferences, improved pinch behavior and additional book formats. See [the roadmap](docs/ROADMAP.md).

## Requirements

- Jellyfin Server 12.0.x
- A Jellyfin **Books** library
- CBZ/ZIP for the current Advanced Reader preview
- JavaScript Injector for automatic Jellyfin Web reader-button integration

The One-Shot resolver follows Jellyfin 12's built-in book extensions: AZW, AZW3, CB7, CBR, CBT, CBZ, EPUB, MOBI and PDF. The Advanced Reader page API currently targets CBZ/ZIP archives only.

## Installation

There is no stable release package yet. Development builds should only be tested on a disposable or backed-up Jellyfin instance. Every successful CI run produces an `AdvancedBooks-dev` artifact containing the plugin DLLs. See [Development Guide](docs/DEVELOPMENT.md).

## Configuration

1. Open **Dashboard -> Plugins -> Advanced Books**.
2. Leave **Enable Advanced Reader integration** enabled if JavaScript Injector is installed.
3. Enable **Komga-compatible One-Shots**.
4. Keep `_oneshots` as the matcher for the usual Komga layout, or use `/_oneshots` for segment-prefix matching.
5. Restart Jellyfin and rescan the affected Books library.

By default, a One-Shot uses its book title as its Jellyfin series name, approximating Komga's one-book-series model.

## Safety

The plugin is read-only with respect to media files. Reader APIs resolve a Jellyfin item ID server-side, verify the current user's visibility, and never accept a client-provided media path.

ZIP access enforces bounded entry/page counts, per-page and total uncompressed-byte limits, a maximum compression ratio and unsafe-entry-path rejection. Pages are streamed from archives rather than extracting the whole book to disk or memory.

Progress writes affect only Jellyfin's normal per-user Book state (`PlaybackPositionTicks`, `Played`, and `LastPlayedDate`); source comic files and their metadata are not modified.

## Documentation

- [Advanced Reader](docs/READER.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Development Guide](docs/DEVELOPMENT.md)
- [Roadmap](docs/ROADMAP.md)
- [Contributing](CONTRIBUTING.md)

## License

MIT. See [LICENSE](LICENSE).

This is a community project and is not affiliated with the Jellyfin, Komga, or JavaScript Injector projects.
