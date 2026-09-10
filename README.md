# Jellyfin Advanced Books

Advanced book, comic, manga and magazine support for **Jellyfin 12**.

> **Status: early development / not yet a stable release.**
> Komga-compatible One-Shot handling, the safe CBZ/ZIP page API, and the first Advanced Reader milestone are implemented.

## What this project is for

Jellyfin 12 significantly improves Books, but dedicated comic servers still provide better library semantics and reading controls. Jellyfin Advanced Books aims to close that gap without forcing users to reorganize an existing Komga library.

The project is designed so that **Komga and Jellyfin can point at the same read-only media tree**.

## Current features

- Jellyfin Server **12.0.x** / .NET 10 foundation.
- Komga-style One-Shots directory matching.
- `_oneshots` default matcher and `/_oneshots` segment-prefix matcher.
- Highest-priority Jellyfin book resolver only for matching One-Shot paths.
- Configurable One-Shot series mapping.
- Authenticated CBZ/ZIP page metadata API.
- Per-page image streaming without downloading/extracting the whole comic archive.
- Natural page ordering (`page2` before `page10`).
- Archive limits for entry count, page count, uncompressed size and compression ratio.
- Rejection of unsafe archive entry paths.
- Initial Advanced Reader with single/double page modes.
- RTL/LTR navigation and Fit Screen/Width/Height/Original modes.
- Zoom, drag-to-pan, keyboard, click/tap, swipe and wheel controls.
- Bounded page cache and nearby-page prefetch.
- Optional automatic Jellyfin Web integration through the Jellyfin 12-compatible JavaScript Injector plugin.
- No source-file moves, renames or rewrites.

Example existing Komga layout:

```text
Books/
├── Space Adventures/
│   ├── Space Adventures v01.cbz
│   ├── Space Adventures v02.cbz
│   └── _oneshots/
│       └── Pluto Adventures.cbz
└── _oneshots/
    ├── A oneshot.cbz
    ├── Another oneshot.cbz
    └── Yet another oneshot.cbz
```

With One-Shot support enabled, files under matching directories are intercepted before Jellyfin's default Books resolver so they do not simply inherit `_oneshots` as their series name.

## Advanced Reader (development preview)

The reader consumes individual pages from Advanced Books instead of downloading the complete CBZ into the browser. The first milestone supports:

- single and double page;
- right-to-left and left-to-right navigation;
- fit screen, width, height and original size;
- 50%-400% zoom and drag-to-pan;
- keyboard, click/tap, swipe and wheel navigation;
- nearby-page prefetch with a bounded Blob URL cache.

To expose the **Advanced Reader** button inside Jellyfin Web today, install a Jellyfin 12-compatible build of the community **JavaScript Injector** plugin and restart Jellyfin. Advanced Books detects it at runtime and registers its embedded reader script; there is no compile-time dependency between the plugins.

The server-side resolver and page API continue to work when JavaScript Injector is not installed. Native clients that do not use Jellyfin Web do not receive the injected reader UI.

See [Advanced Reader](docs/READER.md) for controls and integration details.

## Reader API

```text
GET /AdvancedBooks/Books/{itemId}/Pages
GET /AdvancedBooks/Books/{itemId}/Pages/{pageIndex}
```

Clients supply only a Jellyfin item ID; raw server filesystem paths are never accepted. Both endpoints require an authenticated Jellyfin user, and the requested Book must be visible to that user. Unsupported formats return HTTP 415; invalid or safety-rejected archives return HTTP 422.

The API currently recognizes JPEG, PNG, WebP, GIF, BMP and AVIF image entries. CBR/PDF/EPUB reader pipelines are intentionally deferred until the ZIP pipeline is proven stable.

## Still planned

The next reader milestones include:

- vertical continuous reading;
- Webtoon mode;
- thumbnail/page navigator;
- Jellyfin reading-position synchronization and per-user preferences;
- improved touch/pinch behavior;
- CBR, PDF and EPUB integration.

See [the roadmap](docs/ROADMAP.md) for implementation order.

## Requirements

- Jellyfin Server 12.0.x
- A Jellyfin **Books** library
- CBZ/ZIP for the current Advanced Reader preview
- JavaScript Injector for automatic Jellyfin Web reader-button integration

The One-Shot resolver follows Jellyfin 12's built-in book extensions: AZW, AZW3, CB7, CBR, CBT, CBZ, EPUB, MOBI and PDF. The advanced page API currently targets CBZ/ZIP archives only.

## Installation

There is no stable release package yet. Development builds should only be tested on a disposable or backed-up Jellyfin instance.

Every successful CI run produces an `AdvancedBooks-dev` artifact containing the plugin DLLs. For developers and testers, see [Development Guide](docs/DEVELOPMENT.md).

## Configuration

After the plugin is installed:

1. Open **Dashboard -> Plugins -> Advanced Books**.
2. Leave **Enable Advanced Reader integration** enabled if JavaScript Injector is installed.
3. Enable **Komga-compatible One-Shots**.
4. Keep `_oneshots` as the matcher if that is what your Komga library uses.
5. Use `/_oneshots` if you only want directory segments that start with `_oneshots`.
6. Restart Jellyfin and rescan the affected Books library.

By default, a One-Shot uses its book title as its Jellyfin series name. This is the closest mapping to Komga's model of a One-Shot as a one-book series. The setting can instead preserve a series parsed from the filename or leave the series name empty.

## Safety

The plugin is read-only with respect to media files. Reader APIs resolve a Jellyfin item ID on the server and verify the current user's visibility before reading the Book path. They do not accept a client-provided media path.

ZIP-backed reader access enforces bounded entry/page counts, per-page and total uncompressed byte limits, a maximum compression ratio, and unsafe-entry-path rejection. Pages are streamed from the archive rather than extracted to disk or buffering the entire archive in memory.

## Documentation

- [Advanced Reader](docs/READER.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Development Guide](docs/DEVELOPMENT.md)
- [Roadmap](docs/ROADMAP.md)
- [Contributing](CONTRIBUTING.md)

## License

MIT. See [LICENSE](LICENSE).

This is a community project and is not affiliated with the Jellyfin, Komga, or JavaScript Injector projects.
