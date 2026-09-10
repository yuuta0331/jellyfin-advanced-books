# Jellyfin Advanced Books

Advanced book, comic, manga and magazine support for **Jellyfin 12**.

> **Status: early development / not yet a stable release.**
> The first implemented feature is Komga-compatible One-Shot path handling. The advanced reader is on
> the roadmap and is not included yet.

## What this project is for

Jellyfin 12 significantly improves Books, but dedicated comic servers still provide better library
semantics and reading controls. Jellyfin Advanced Books aims to close that gap without forcing users
to reorganize an existing Komga library.

The project is designed so that **Komga and Jellyfin can point at the same read-only media tree**.

## Current features

- Jellyfin Server **12.0.x** / .NET 10 foundation.
- Komga-style One-Shots directory matching.
- `_oneshots` default matcher.
- `/_oneshots` segment-prefix matcher, matching Komga's stricter mode.
- Highest-priority Jellyfin book resolver only for matching One-Shot paths.
- Configurable One-Shot series mapping.
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

With One-Shot support enabled, files under matching directories are intercepted before Jellyfin's
default Books resolver so they do not simply inherit `_oneshots` as their series name.

## Planned advanced reader

The goal is a reader closer to Komga rather than a lightly styled version of Jellyfin's current
reader. Planned capabilities include:

- single and double page;
- right-to-left and left-to-right page order;
- fit width, fit height, fit screen and original size;
- zoom, pinch zoom and pan;
- vertical continuous reading;
- webtoon mode;
- lazy loading and page prefetch;
- mouse, keyboard, touch, swipe and wheel navigation;
- thumbnails and fast page jumping;
- Jellyfin reading-position synchronization.

See [the roadmap](docs/ROADMAP.md) for implementation order.

## Requirements

- Jellyfin Server 12.0.x
- A Jellyfin **Books** library
- Supported book formats handled by Jellyfin 12

The initial resolver follows Jellyfin 12's built-in book extensions: AZW, AZW3, CB7, CBR, CBT, CBZ,
EPUB, MOBI and PDF.

## Installation

There is no stable release package yet. Development builds should only be tested on a disposable or
backed-up Jellyfin instance.

For developers and testers, see [Development Guide](docs/DEVELOPMENT.md).

## Configuration

After the plugin is installed:

1. Open **Dashboard -> Plugins -> Advanced Books**.
2. Enable **Komga-compatible One-Shots**.
3. Keep `_oneshots` as the matcher if that is what your Komga library uses.
4. Use `/_oneshots` if you only want directory segments that start with `_oneshots`.
5. Restart Jellyfin and rescan the affected Books library.

By default, a One-Shot uses its book title as its Jellyfin series name. This is the closest mapping to
Komga's model of a One-Shot as a one-book series. The setting can instead preserve a series parsed from
the filename or leave the series name empty.

## Safety

The current resolver is read-only with respect to media files. Future page APIs will accept Jellyfin
item IDs rather than arbitrary filesystem paths and will include archive traversal/decompression
protections before they are exposed to the reader.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Development Guide](docs/DEVELOPMENT.md)
- [Roadmap](docs/ROADMAP.md)
- [Contributing](CONTRIBUTING.md)

## License

MIT. See [LICENSE](LICENSE).

This is a community project and is not affiliated with the Jellyfin or Komga projects.
