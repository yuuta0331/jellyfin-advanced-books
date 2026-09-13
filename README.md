# Jellyfin Advanced Books

<p align="center">
  <img src="assets/advanced-books-banner.svg" alt="Jellyfin Advanced Books" width="100%">
</p>

Advanced comic, manga, magazine and book support for **Jellyfin 12**.

> **Status:** Development preview. The current Advanced Reader supports CBZ/ZIP archives.

## Features

- Single Page, Double Page, Vertical Continuous and Webtoon reading modes
- Smart spreads with RTL/LTR reading direction
- Fit Screen / Width / Height / Original sizing and 50%-400% zoom
- Mode-aware click/tap navigation, mouse grab-to-pan, touch swipe/pan, focal-point pinch/wheel zoom and double-tap zoom
- Thumbnail page navigator and direct page scrubber
- Per-user reading progress shared with Jellyfin's built-in ComicsPlayer, plus reader preferences stored in Jellyfin
- Jellyfin title, author, series, issue and year display with visibility controls
- English, Japanese, German, French, Spanish and Simplified Chinese UI with automatic detection or a per-user language override
- Browser/mobile Back closes the Advanced Reader and returns to the underlying Jellyfin screen
- Optional replacement of Jellyfin Book Play/Resume/Start-over actions across details, Home/Library cards, lists, commands and context menus
- Komga-compatible `_oneshots` handling without reorganizing the media library
- Optional direct Komga API metadata synchronization (no ComicInfo dependency), with exact file-path mapping for Docker/host path differences
- Read-only archive access with bounded extraction, traversal checks and other safety limits

## Requirements

- Jellyfin Server **12.0.x**
- A Jellyfin **Books** library
- CBZ/ZIP for the Advanced Reader
- [Jellyfin JavaScript Injector](https://github.com/n00bcodr/Jellyfin-JavaScript-Injector) for the **Advanced Reader** button in Jellyfin Web

## Installation

Add the Advanced Books repository in **Dashboard -> Plugins -> Repositories**:

```text
https://raw.githubusercontent.com/yuuta0331/jellyfin-advanced-books/main/manifest.json
```

Then install **Advanced Books** from **Plugins -> Catalog -> Books** and restart Jellyfin.

For the Advanced Reader button in Jellyfin Web, also add the Jellyfin 12 JavaScript Injector repository:

```text
https://raw.githubusercontent.com/n00bcodr/jellyfin-plugins/main/12/manifest.json
```

Install **JavaScript Injector**, restart Jellyfin, and keep **Enable Advanced Reader integration** enabled in the Advanced Books plugin settings.

Future Advanced Books releases are published through the same repository manifest, so compatible updates can be discovered from Jellyfin's plugin catalog.

For manual installation and upgrade details, see [Installation and Updates](docs/INSTALLATION.md).

## Komga-compatible One-Shots

Advanced Books can treat files below matching `_oneshots` directories as independent One-Shots before Jellyfin's default book resolver.

```text
Books/
├── Series A/
│   ├── Series A v01.cbz
│   └── _oneshots/
│       └── Side Story.cbz
└── _oneshots/
    └── Standalone.cbz
```

The default matcher is `_oneshots`. Use `/_oneshots` when you want segment-prefix matching.

## Direct Komga metadata synchronization

Advanced Books can import metadata that is stored **directly in Komga's database** through the Komga API. It does not require or read `ComicInfo.xml` for this synchronization.

In **Dashboard -> Plugins -> Advanced Books**, enable **Import metadata directly from Komga**, then configure:

- the Komga server URL;
- a Komga **administrator** API key (recommended), or administrator username/password for Basic authentication; Komga hides full Book file paths from non-admin users;
- optional path mappings when Komga and Jellyfin see the same files under different paths, for example `/data/manga => G:/Manga`;
- whether synchronization should run automatically after Jellyfin library scans.

Matching is intentionally strict: Komga's Book file URL is converted to a filesystem path, path mappings are applied, and the result must exactly match a Jellyfin Book path. Advanced Books does not guess by title.

The sync imports supported Book/Series metadata such as title, summary, series, release date/year, issue number, genres, publisher, tags, ISBN and authors/roles. It also records stable Komga Book/Series provider IDs. Use **Save & test connection**, **Save & sync now**, or Jellyfin's **Dashboard -> Scheduled Tasks -> Sync metadata from Komga**.

## Languages

The Advanced Reader and plugin configuration page follow Jellyfin Web's display language when available.

Supported languages:

- English
- 日本語
- Deutsch
- Français
- Español
- 简体中文

Unsupported locales fall back to English.

## Documentation

- [Installation and Updates](docs/INSTALLATION.md)
- [Advanced Reader](docs/READER.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Development Guide](docs/DEVELOPMENT.md)
- [Roadmap](docs/ROADMAP.md)
- [Contributing](CONTRIBUTING.md)

## Development

```bash
dotnet restore jellyfin-advanced-books.slnx
dotnet build jellyfin-advanced-books.slnx -c Release
dotnet test jellyfin-advanced-books.slnx -c Release
```

See [Development Guide](docs/DEVELOPMENT.md) for release and integration-test details.

## AI-assisted development

AI-assisted development tools have been used in this project for tasks including design exploration, implementation, review, documentation and test support. AI-generated or AI-assisted changes are reviewed and validated before they are accepted; project maintainers remain responsible for the code and releases.

See [AI Usage](AI_USAGE.md) for details.

## License

MIT. See [LICENSE](LICENSE).

This is a community project and is not affiliated with Jellyfin, Komga or JavaScript Injector.
