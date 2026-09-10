# Jellyfin Advanced Books

Advanced book, comic, manga and magazine support for **Jellyfin 12**.

> **Status: early development / not yet a stable release.**
> Komga-compatible One-Shot handling, safe CBZ/ZIP per-page delivery, paged/continuous Advanced Reader modes, Jellyfin-backed reading progress, a lazy thumbnail page navigator, per-user reader preferences, and paged pinch zoom are implemented.

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
- **Two-finger pinch-to-zoom in paged, Vertical Continuous and Webtoon modes.**
- **Responsive auto-hiding reader chrome** with center-tap/click reveal.
- **Direct page scrubber in every reader mode** for fast long-book navigation.
- Compact desktop controls and a mobile settings bottom sheet.
- Keyboard, click/tap, swipe and wheel controls.
- IntersectionObserver-based continuous lazy loading.
- Bounded page cache, nearby prefetch and distant-request cancellation.
- **Lazy thumbnail page navigator** with direct page jumping.
- Server-side thumbnail generation through Jellyfin's image processor.
- Bounded thumbnail cache in the browser and plugin data directory.
- **Per-user reading position stored in Jellyfin user data.**
- **Automatic resume for unfinished books, including across Jellyfin Web clients.**
- **Per-user reader preferences stored in Jellyfin's display-preferences database.**
- Reader layout, direction, fit mode and paged zoom restore across Jellyfin Web clients for the same user.
- Final-page completion marks the Jellyfin Book as played.
- Resume positions use Jellyfin's built-in ComicsPlayer page/tick convention.
- Optional automatic Jellyfin Web integration through a Jellyfin 12-compatible JavaScript Injector plugin.
- Reproducible root-level plugin ZIP packaging with MD5 and SHA-256 checksums.
- Jellyfin repository `manifest.json` generation for published releases.
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

Reader controls no longer consume permanent screen space. A compact top chrome and bottom navigation strip appear when the reader opens, then auto-hide while reading. Move the mouse or tap/click the center area to bring them back. The bottom strip includes Previous/Next controls plus a page scrubber that can jump directly across long manga volumes in every layout. Reader settings live in a desktop popover or mobile bottom sheet.

All four layouts support 50%-400% reader zoom. Vertical Continuous and Webtoon keep native one-finger vertical scrolling while also supporting the zoom controls, Ctrl+wheel, and two-finger pinch. At greater than 100% zoom, continuous layouts can be panned with normal scrolling/touch and desktop drag panning.

The **Pages** button opens a thumbnail navigator. Thumbnails are loaded only near the navigator viewport and are requested from a bounded server-side thumbnail endpoint. Jellyfin's normal image processor creates the small cached files; the temporary full-resolution extracted page is deleted immediately after processing. Selecting a thumbnail jumps directly to that page.

Reading position is saved to Jellyfin's normal per-user item data after navigation settles and is flushed when the reader closes. Unfinished books reopen at the saved page. Reaching the final page marks the Book as played. Non-final progress updates do not clear an existing played state, so starting a reread does not silently mark a completed book unread.

Reader preferences are also stored per Jellyfin user. Single/Double/Vertical/Webtoon layout, RTL/LTR direction, fit mode and paged zoom are restored after reading-position resume completes so the saved page is established before the saved presentation mode is re-applied.

### Required companion plugin for Jellyfin Web

To expose the **Advanced Reader** button inside Jellyfin Web, install the community [Jellyfin JavaScript Injector](https://github.com/n00bcodr/Jellyfin-JavaScript-Injector) plugin. Advanced Books detects it at runtime and registers its embedded reader scripts automatically; you do **not** need to copy/paste the Advanced Books reader JavaScript manually.

For **Jellyfin 12**, add this JavaScript Injector repository URL in **Dashboard -> Plugins -> Repositories**:

```text
https://raw.githubusercontent.com/n00bcodr/jellyfin-plugins/main/12/manifest.json
```

Then install **JavaScript Injector** from the Jellyfin plugin catalog and restart Jellyfin. Jellyfin 12 support was introduced in JavaScript Injector `v4.0.0.0`; use the current Jellyfin 12-compatible release.

Without JavaScript Injector, the Advanced Books server-side resolver and APIs can still load, but the **Advanced Reader** button is not automatically inserted into Jellyfin Web.

See [Advanced Reader](docs/READER.md) for controls and implementation details.

## Reader API

```text
GET /AdvancedBooks/Books/{itemId}/Pages
GET /AdvancedBooks/Books/{itemId}/Pages/{pageIndex}
GET /AdvancedBooks/Books/{itemId}/Pages/{pageIndex}/Thumbnail?width=180
GET /AdvancedBooks/Books/{itemId}/Progress
PUT /AdvancedBooks/Books/{itemId}/Progress
GET /AdvancedBooks/Reader/Preferences
PUT /AdvancedBooks/Reader/Preferences
```

Clients supply only a Jellyfin item ID; raw server filesystem paths are never accepted. Endpoints require an authenticated Jellyfin user and a Book visible to that user where applicable. Unsupported formats return HTTP 415; invalid or safety-rejected archives return HTTP 422.

Thumbnail widths are constrained to 96-320 pixels. Generated thumbnails are cached beneath the plugin data directory using an archive/page/version-aware key. Full-resolution extracted work files are not retained.

Progress page indexes are validated against the server-side archive page count. Positions use `pageIndex * 10,000` playback ticks, matching Jellyfin Web's built-in ComicsPlayer convention so the standard and Advanced readers can share resume data.

Reader preferences are stored in Jellyfin's display-preferences database under an Advanced Books-specific namespace. The preferences API always resolves the authenticated Jellyfin user and does not accept an arbitrary user ID.

The page API currently recognizes JPEG, PNG, WebP, GIF, BMP and AVIF image entries. CBR/PDF/EPUB Advanced Reader pipelines are deferred until the ZIP pipeline is proven stable.

## Still planned

Important next milestones are further mobile/touch tuning, live Jellyfin integration testing, and additional book formats. See [the roadmap](docs/ROADMAP.md).

## Requirements

- Jellyfin Server 12.0.x
- A Jellyfin **Books** library
- CBZ/ZIP for the current Advanced Reader preview
- [Jellyfin JavaScript Injector](https://github.com/n00bcodr/Jellyfin-JavaScript-Injector) for automatic Jellyfin Web reader-button integration

The One-Shot resolver follows Jellyfin 12's built-in book extensions: AZW, AZW3, CB7, CBR, CBT, CBZ, EPUB, MOBI and PDF. The Advanced Reader page API currently targets CBZ/ZIP archives only.

## Installation

There is no stable release yet. Development preview releases contain `Jellyfin.Plugin.AdvancedBooks.dll` and `Jellyfin.AdvancedBooks.Core.dll` directly at the root of `AdvancedBooks_<version>.zip`, together with `.md5` and `.sha256` checksum files. Extract the two DLLs into one Advanced Books plugin-version directory and restart Jellyfin. Test development releases on a disposable or backed-up Jellyfin instance first.

Every successful CI run also publishes the same package shape as the `AdvancedBooks-dev` workflow artifact. The repository contains a Jellyfin-compatible `manifest.json`; release automation updates it from the bytes of the actually published GitHub Release asset so its MD5 checksum matches Jellyfin's installer verification.

The standard Jellyfin **Repository URL** flow requires the manifest and release assets to be anonymously reachable over HTTPS. While this GitHub repository remains private, use the downloaded development package for manual installation; do not expect Jellyfin to authenticate to the private GitHub repository automatically.

See [Development Guide](docs/DEVELOPMENT.md) for build and release details.

## Configuration

1. Install [Jellyfin JavaScript Injector](https://github.com/n00bcodr/Jellyfin-JavaScript-Injector) if you want the **Advanced Reader** button in Jellyfin Web, then restart Jellyfin.
2. Open **Dashboard -> Plugins -> Advanced Books**.
3. Leave **Enable Advanced Reader integration** enabled if JavaScript Injector is installed.
4. Enable **Komga-compatible One-Shots**.
5. Keep `_oneshots` as the matcher for the usual Komga layout, or use `/_oneshots` for segment-prefix matching.
6. Restart Jellyfin and rescan the affected Books library.

By default, a One-Shot uses its book title as its Jellyfin series name, approximating Komga's one-book-series model.

## Safety

The plugin is read-only with respect to media files. Reader APIs resolve a Jellyfin item ID server-side, verify the current user's visibility, and never accept a client-provided media path.

ZIP access enforces bounded entry/page counts, per-page and total uncompressed-byte limits, a maximum compression ratio and unsafe-entry-path rejection. Pages are streamed from archives rather than extracting the whole book to disk or memory.

Thumbnail generation may temporarily extract one validated page to the plugin work directory so Jellyfin can resize it. That source work file is deleted immediately after processing; only the small generated thumbnail cache remains.

Progress writes affect only Jellyfin's normal per-user Book state (`PlaybackPositionTicks`, `Played`, and `LastPlayedDate`); reader preferences affect only Jellyfin's display-preferences database. Source comic files and their metadata are not modified.

## Documentation

- [Advanced Reader](docs/READER.md)
- [Pinch Zoom](docs/PINCH_ZOOM.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Development Guide](docs/DEVELOPMENT.md)
- [Roadmap](docs/ROADMAP.md)
- [Contributing](CONTRIBUTING.md)

## License

MIT. See [LICENSE](LICENSE).

This is a community project and is not affiliated with the Jellyfin, Komga, or JavaScript Injector projects.
