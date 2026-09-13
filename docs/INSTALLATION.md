# Installation and Updates

Advanced Books publishes a Jellyfin-compatible plugin repository manifest. Using the repository is the recommended installation method because Jellyfin can discover compatible releases and future updates without manual DLL replacement.

## 1. Add the Advanced Books repository

In Jellyfin:

1. Open **Dashboard -> Plugins -> Repositories**.
2. Select **Add**.
3. Set the repository name to **Advanced Books**.
4. Use this repository URL:

```text
https://raw.githubusercontent.com/yuuta0331/jellyfin-advanced-books/main/manifest.json
```

5. Save the repository.

Advanced Books will then appear in **Dashboard -> Plugins -> Catalog**, under the **Books** category, with its project icon and catalog description.

## 2. Install Advanced Books

1. Open **Dashboard -> Plugins -> Catalog**.
2. Open **Advanced Books**.
3. Install the newest version compatible with Jellyfin 12.
4. Restart Jellyfin when prompted or after installation.

The catalog package contains the two runtime assemblies required by Advanced Books. Do not copy DLLs manually when using the repository installation method.

## 3. Install JavaScript Injector for the Web reader

The server-side One-Shot resolver and APIs work without JavaScript Injector, but the **Advanced Reader** button inside Jellyfin Web requires the Jellyfin 12-compatible JavaScript Injector plugin.

Add the JavaScript Injector repository:

```text
https://raw.githubusercontent.com/n00bcodr/jellyfin-plugins/main/12/manifest.json
```

Install **JavaScript Injector**, restart Jellyfin, then keep **Dashboard -> Plugins -> Advanced Books -> Enable Advanced Reader integration** enabled.

Optionally enable **Use Advanced Reader for Jellyfin book actions** to make Jellyfin's normal Book Play/Resume and Start from beginning actions open Advanced Reader for supported CBZ/ZIP items. This option is off by default and requires a Jellyfin restart after changing it.

Advanced Books registers its own embedded reader scripts automatically. No copy/paste JavaScript step is required.

## Updating

When a new Advanced Books release is published, release automation updates `manifest.json` from the exact published ZIP and checksum. Jellyfin therefore sees the new compatible version through the same repository entry.

To update:

1. Open **Dashboard -> Plugins -> Catalog** or the installed plugin page.
2. Install the available Advanced Books update.
3. Restart Jellyfin.
4. Hard-refresh Jellyfin Web if reader UI assets from the previous version are still cached.

You do not need to delete the plugin configuration. Reader preferences are stored per Jellyfin user, while plugin resolver configuration is retained by Jellyfin.

## Manual installation fallback

Manual installation is intended for troubleshooting or development builds.

1. Stop Jellyfin.
2. Download the desired `AdvancedBooks_<version>.zip` GitHub Release asset.
3. Verify the published MD5/SHA-256 checksum if desired.
4. Keep only one active Advanced Books version directory in the Jellyfin plugins directory.
5. Extract `Jellyfin.Plugin.AdvancedBooks.dll` and `Jellyfin.AdvancedBooks.Core.dll` into a fresh version directory.
6. Start Jellyfin.

Do not overwrite DLLs inside an older version-named directory while Jellyfin is running. That can leave Jellyfin metadata and the actually loaded assembly out of sync.

## Supported UI languages

The Advanced Reader and Advanced Books configuration page automatically follow the Jellyfin/browser language for:

- English
- Japanese
- German
- French
- Spanish
- Simplified Chinese

Unsupported locales fall back to English.

## Catalog metadata

The custom repository publishes the fields Jellyfin uses for catalog presentation:

- **Name:** Advanced Books
- **Category:** Books
- **Owner:** yuuta0331
- **Overview:** Advanced comic, manga, magazine and book reader for Jellyfin 12.
- **Description:** Includes Komga-compatible One-Shots and a localized Advanced Reader.
- **Catalog icon:** `assets/advanced-books-icon.png` (the SVG source is kept alongside it)
- **Target ABI:** Jellyfin 12

The catalog icon is referenced through `imageUrl` in the repository manifest. Jellyfin fetches the image during installation/update, so an already installed version may keep its previous icon until the next plugin update.

## Official Jellyfin catalog

The repository above is a third-party Jellyfin repository and is usable immediately. Inclusion in Jellyfin's default official plugin repository is a separate upstream review/acceptance process; the catalog metadata, packaging, checksums, license, documentation and release automation in this repository are prepared so that an upstream submission can be pursued later.
