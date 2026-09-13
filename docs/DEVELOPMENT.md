# Development Guide

## Prerequisites

- .NET 10 SDK
- Git
- Python 3 for release/package validation helpers
- Node.js for `node --check` when modifying reader scripts
- a Jellyfin 12 test server for integration testing
- the Jellyfin 12-compatible JavaScript Injector plugin when testing automatic Web reader integration

The plugin references Jellyfin 12.0.0 NuGet packages and targets `net10.0`.

## Build and test

From the repository root:

```bash
dotnet restore jellyfin-advanced-books.slnx
dotnet build jellyfin-advanced-books.slnx -c Release
dotnet test jellyfin-advanced-books.slnx -c Release
python -m unittest discover -s tests -p 'test_release_*.py' -v
for file in src/Jellyfin.Plugin.AdvancedBooks/Reader/*.js; do node --check "$file"; done
```

On PowerShell, run `node --check` once for each `.js` file instead of the shell loop.

The Jellyfin assemblies are compile-time dependencies and are excluded from the plugin's runtime assets. Do not copy Jellyfin server assemblies into the plugin package.

Automatic CI runs for non-draft pull requests that affect code/configuration, plus manual `workflow_dispatch` runs. Documentation-only pull requests are ignored, draft pull requests defer the build until `ready_for_review`, and stale runs for the same pull request are cancelled. `main` does not run this CI workflow because the Release workflow performs the same syntax/build/test validation before publishing.

Every successful CI run creates an `AdvancedBooks-dev` artifact containing `AdvancedBooks_<version>.zip`, its MD5 checksum, its SHA-256 checksum and the release changelog. The plugin ZIP contains the two runtime DLLs directly at ZIP root so the same artifact layout can be used by Jellyfin's repository installer.

CI creates the package twice from the same Release build and compares the resulting ZIP and checksum files byte-for-byte. `scripts/package_plugin.py` fixes archive timestamps, permissions, ordering, compression mode and compression level so packaging itself is deterministic.

## Release packaging

Release metadata is defined in `build.yaml` and must match the plugin project's `<Version>`. Each release must also include a structured Markdown note at `release-notes/v<version>.md`.

Keep the short `build.yaml` changelog suitable for Jellyfin's Catalog history, and use the versioned Markdown file for the human-facing GitHub Release page. Prefer clear sections and bullets such as Highlights, Reader UI & UX, Settings, Localization, Accessibility, Updating, and other sections that fit the release. Do not repeat the release title inside the body; GitHub already displays it above the notes.

Validate release metadata with:

```bash
python scripts/validate_release.py
```

To package a local Release build:

```bash
python scripts/package_plugin.py \
  --input-dir src/Jellyfin.Plugin.AdvancedBooks/bin/Release/net10.0 \
  --output-dir artifacts/release \
  --version 0.14.0.0
```

The generated files are:

```text
AdvancedBooks_0.14.0.0.zip
AdvancedBooks_0.14.0.0.zip.md5
AdvancedBooks_0.14.0.0.zip.sha256
```

The MD5 value is intentional because Jellyfin 12 verifies plugin repository packages against the manifest checksum using MD5. SHA-256 is published alongside it for stronger manual integrity checking.

`.github/workflows/release.yml` runs automatically on `main` only when `build.yaml` changes, plus manual dispatch. That makes the release-version metadata the deliberate publish trigger and prevents ordinary docs/manifest pushes from rebuilding the plugin. It validates/builds/tests the exact commit, requires `release-notes/v<version>.md`, creates the package, publishes a GitHub prerelease if that version tag does not already exist, refreshes the GitHub Release body from the structured Markdown notes, downloads the published ZIP again, and generates the manifest entry from the bytes of that published asset. The generated manifest commit includes a CI-skip marker as an additional guard against recursive workflow runs.

The workflow updates root `manifest.json` with version, target ABI, release URL, MD5 checksum, UTC timestamp and the concise Catalog changelog from `build.yaml`. Re-running the workflow for an existing release preserves the published release assets, refreshes the human-facing Release notes, and can reconstruct the manifest entry from the already-published ZIP.

The public repository manifest is intended for Jellyfin's standard Repository URL flow. Release automation regenerates the newest manifest entry from the actually published ZIP, so the installer checksum and source URL remain synchronized.

## Project layout

```text
src/
  Jellyfin.AdvancedBooks.Core/
    Archives/                         host-independent ZIP reader and safety policy
    Komga/                            host-independent Komga compatibility logic
    Reading/                          progress mapping + preference validation
  Jellyfin.Plugin.AdvancedBooks/
    Api/                              page/progress/preferences/thumbnail endpoints
    Configuration/                    server/plugin settings
    Reader/                           localization, reader, progress, preferences, navigator and gesture scripts
    Resolvers/                        Jellyfin library resolver integration
    Services/                         runtime integration + thumbnail generation
scripts/
  package_plugin.py                   deterministic plugin ZIP + checksums
  update_manifest.py                  Jellyfin repository manifest updater
  validate_release.py                 build/release/catalog metadata validation
  validate_localization.py            six-language reader/config coverage validation
tests/
  Jellyfin.AdvancedBooks.Core.Tests/ unit tests
  test_release_scripts.py             packaging/manifest helper tests
docs/
  ARCHITECTURE.md
  DEVELOPMENT.md
  INSTALLATION.md
  PINCH_ZOOM.md
  READER.md
  ROADMAP.md
```

## Local Jellyfin testing

Use a disposable or backed-up Jellyfin 12 test instance.

1. Build the solution in `Release`, or download the `AdvancedBooks-dev` artifact / GitHub development release.
2. Create one Advanced Books plugin-version directory under the Jellyfin plugins directory and extract the two DLLs from `AdvancedBooks_<version>.zip` directly into it.
3. Ensure both `Jellyfin.Plugin.AdvancedBooks.dll` and `Jellyfin.AdvancedBooks.Core.dll` are present in that directory.
4. If testing the Web reader, install a Jellyfin 12-compatible JavaScript Injector build.
5. Restart Jellyfin.
6. Open Dashboard -> Plugins -> Advanced Books and configure the reader/One-Shot settings.
7. Rescan a small Books test library.

Do not start integration testing with a production-scale library. First test a fixture containing regular series, several `_oneshots` files, one nested `_oneshots`, and several small CBZ files with deliberately non-lexical names such as `page2.jpg` and `page10.jpg`. Include one archive containing `__MACOSX/._page1.jpg` and `folder/._page2.png` metadata entries beside real pages and confirm those metadata entries never appear in the page list.

### Page API smoke test

With an authenticated Jellyfin session and a CBZ-backed Book item ID, verify:

```text
GET /AdvancedBooks/Books/{itemId}/Pages
GET /AdvancedBooks/Books/{itemId}/Pages/0
```

The first request should return JSON page metadata plus Jellyfin title/authors/series/issue/year context without a server filesystem path. The second should return the first image using its image content type, `Cache-Control: private, no-store`, and `X-AdvancedBooks-Page-Index: 0`. Repeat for another page and verify the index header changes with the requested page. Verify a user that cannot see the library gets 404 for the item and an unauthenticated request is rejected by Jellyfin authentication.

Also test a corrupt ZIP and a deliberately over-limit fixture; these should fail cleanly with HTTP 422 rather than exhausting server memory or extracting files.

### Thumbnail API smoke test

For the same authenticated Book, verify:

```text
GET /AdvancedBooks/Books/{itemId}/Pages/0/Thumbnail?width=128
```

The response should be a small WebP/JPEG/PNG image, should include `X-AdvancedBooks-Thumbnail-Width`, and should not expose a filesystem path. Requests below 96 or above 320 must return HTTP 400.

Check width normalization as well: representative requests in the allowed range should map downward to one of 96, 128, 180, 240 or 320 pixels. Repeating the same page/width should reuse the plugin cache rather than recreate the thumbnail. Also create any larger normalized variant (for example 180px), then request 128px for the same page and confirm the compatible larger cached thumbnail can be reused without another image-processing pass.

After generation, verify the plugin's `reader-thumbnail-work` directory contains no retained full-resolution page from the completed request. The temporary image-processor result must also be removed after the plugin-owned thumbnail is copied.

### Progress API smoke test

For the same authenticated Book, verify:

```text
GET /AdvancedBooks/Books/{itemId}/Progress
PUT /AdvancedBooks/Books/{itemId}/Progress
```

A PUT body such as:

```json
{
  "PageIndex": 4
}
```

should store `PlaybackPositionTicks = 40000`. A subsequent GET should return page index `4`. An index below zero or at/above the archive page count must return HTTP 400.

Saving the final page must set the Jellyfin Book's played state. Saving an earlier page on a Book that is already played must not automatically clear that played state. In the Web reader, navigate to a middle page and close immediately while another progress PUT is still in flight; reopen and verify the newest reached page wins. Also mark a Book played, leave a non-zero stored position, and verify Advanced Reader restores that page instead of forcing page 1.

### Reader preferences API smoke test

For an authenticated Jellyfin user, verify:

```text
GET /AdvancedBooks/Reader/Preferences
PUT /AdvancedBooks/Reader/Preferences
```

A new user should receive the safe defaults: Single Page, RTL, Fit Screen, 100% zoom, black background, page transitions enabled, touch gestures enabled, metadata visible, all metadata fields visible and metadata auto-scroll enabled. A representative PUT body is:

```json
{
  "Layout": "double",
  "Direction": "rtl",
  "Fit": "width",
  "Zoom": 1.35,
  "SidePadding": 5,
  "PageGap": 8,
  "Background": "gray",
  "AnimateTransitions": false,
  "TouchGestures": true,
  "ShowMetadata": true,
  "ShowMetadataTitle": true,
  "ShowMetadataAuthors": false,
  "ShowMetadataSeries": true,
  "ShowMetadataIssue": true,
  "ShowMetadataYear": false,
  "AutoScrollMetadata": true,
  "Language": "auto"
}
```

A subsequent GET should return the same normalized values. Invalid layout/direction/fit/background values, zoom below 0.5, zoom above 4.0, NaN or infinity-equivalent input must not be persisted. Confirm two Jellyfin users can store different values, while two Web clients signed in as the same user receive the same settings.

The preferences endpoint must not accept an arbitrary user id. Storage belongs to the authenticated user and is backed by Jellyfin's display-preferences database.

### Localization validation

Run:

```bash
python scripts/validate_localization.py
```

The validation requires all six supported locales in both the reader localization bridge and the plugin configuration page, checks representative Reader/metadata keys, and verifies that Preferences/Gestures use stable localized-control action identifiers rather than relying only on English tooltips.

### Built embedded-resource verification

CI and release validation must inspect the **built plugin DLL**, not only the JavaScript source files. The `EmbeddedReaderResourceVerifier` reads managed manifest resources directly from the PE/CLI resource directory and verifies:

- plugin AssemblyVersion matches the release version;
- all seven reader resources (Localization, Core, Progress, Preferences, Navigator, Gestures and Jellyfin Integration) are present;
- every reader resource is strict UTF-8;
- no unexpected control characters are present; and
- each resource remains within the 96 KiB JavaScript Injector defensive limit.

Run it locally after a Release build with:

```bash
dotnet run \
  --project tools/EmbeddedReaderResourceVerifier/EmbeddedReaderResourceVerifier.csproj \
  --configuration Release \
  --no-build \
  -- \
  src/Jellyfin.Plugin.AdvancedBooks/bin/Release/net10.0/Jellyfin.Plugin.AdvancedBooks.dll \
  0.14.0.0
```

A source file passing `node --check` is not sufficient evidence if the bytes embedded into the final DLL differ.

### Web reader smoke test

After Advanced Books and JavaScript Injector are both installed and Jellyfin has restarted:

1. confirm the Jellyfin log reports that the Advanced Books reader was registered with JavaScript Injector;
2. open a supported CBZ Book detail page;
3. confirm **Advanced Reader** appears in the main detail buttons with a single reader-mode icon (not duplicated/multi-book glyphs);
4. open it and verify only the current/nearby page endpoints are requested in browser developer tools rather than a full-book download;
5. verify a new/default user opens with Fit Screen; upgrade a user that previously persisted legacy Fit Height and confirm it migrates to Fit Screen, then explicitly select Fit Height and confirm the current preference schema preserves that choice; verify all four fit modes in portrait/landscape and after resizing;
6. verify Vertical Continuous and Webtoon can be scrolled rapidly through a long book containing mixed portrait, landscape, short and very tall pages while observer loading, directional prefetch and direct jumps overlap; every `.advancedBooksReaderPageSlot` must contain at most one `<img>`, no page may appear duplicated side-by-side, pages ahead are prefetched while the cache remains bounded, and the viewport marker follows the page actually being read;
7. open **Pages**, scroll several screens downward quickly, stop on a previously unseen range, and keep the panel open for at least 10 seconds; every visible card must either show its thumbnail or a contained failure state—no visible card may remain forever as plain `Page N`; verify off-screen queued work is deprioritized/aborted, a stalled visible thumbnail can fall back to the page endpoint, and no more than two full-page fallbacks run concurrently;
8. jump to a distant thumbnail and confirm the live reader session reaches the intended page directly without temporarily changing layouts;
9. close the page navigator during thumbnail loading and confirm outstanding requests are aborted;
10. select Double Page and move through portrait pages, then landscape pages and the final page; verify orientation is resolved before each spread is shown, so there is no brief incorrect two-page spread followed by a relayout. Then select LTR, Fit Width and a non-100% zoom, close the reader, and confirm those controls restore;
11. change controls and immediately close while a preference PUT is still in flight; reopen and confirm the newest queued state wins;
12. repeat the preference restore test from a second Jellyfin Web browser/client signed in as the same user;
13. navigate to a middle page, close the reader, reopen it, and confirm it resumes at that page before applying saved reader controls;
14. repeat the reopen test from a second Jellyfin Web browser/client signed in as the same user;
15. navigate to the final page and confirm the Book becomes played in Jellyfin;
16. reopen the completed Book and verify rereading earlier pages does not clear the played state;
17. verify arrow keys, Page Up/Down, Space, Home/End, click/tap zones, horizontal swipe and wheel navigation;
18. confirm top/bottom reader chrome auto-hides; tiny mouse jitter must leave it hidden, deliberate mouse movement or movement near a top/bottom edge must restore it, hovering visible chrome must keep it open, and a center tap/click must toggle it without turning a page;
19. drag the bottom page scrubber from the beginning to a distant page in Single, Double, Vertical and Webtoon layouts; verify the thumbnail/page preview stays directly above the active finger/pointer, the loading spinner remains centered inside the preview frame without text leaking beside it, stale preview requests are aborted, and the intended page is reached directly;
20. hold the scrubber for longer than the normal auto-hide delay and confirm the reader chrome remains visible until scrubbing ends;
21. open Reader Settings and confirm desktop uses a compact floating panel while a narrow/mobile viewport uses a touch-friendly bottom sheet; on mobile confirm the top/bottom icon and navigation buttons remain square rather than vertically stretched;
22. confirm Previous/Next use centered SVG chevrons rather than baseline-sensitive text glyphs, and confirm the page position is shown only in the bottom controls while the hidden top counter still updates progress;
23. open Advanced Reader, then use browser Back / Android back gesture; confirm the reader closes and the same Jellyfin detail page remains visible. Reopen it, use the reader Close button, and confirm the synthetic reader history entry is consumed without navigating away;
24. enable **Use Advanced Reader for Jellyfin book actions**, restart Jellyfin, and confirm the separate Advanced Reader detail button is hidden when Jellyfin's native Book actions are available. Jellyfin Resume/Play must open Advanced Reader at saved progress, while Start from beginning must open page 1. Disable the option, restart, and confirm Jellyfin's built-in reader actions work normally again;
22. in Vertical and Webtoon, verify Fit controls, +/-/0, Ctrl+wheel zoom, two-finger pinch zoom and >100% desktop drag panning work without disabling normal one-finger vertical scrolling;
23. change Side padding and Page gap in Vertical/Webtoon, reopen the reader, and verify both values restore for the same Jellyfin user;
24. use a book with a deliberately long title, authors and series name. Confirm overflowing metadata automatically scrolls far enough to reveal the complete text, then disable Auto-scroll and confirm it stops. Toggle the metadata header and each Title/Authors/Series/Issue/Year field independently, reopen the reader, and verify every choice restores for the same Jellyfin user;
25. where the Fullscreen API is available, verify the top fullscreen button and F key enter/exit reader fullscreen without closing the reader;
26. zoom above 100% in a paged mode, drag to pan, then close with Escape;
27. reopen the reader and verify there are no stale overlays or broken Blob URLs.

### Mobile pinch smoke test

Run these checks on a real touch device or browser/device mode that emits touch Pointer Events. Android Chrome should be covered first; also test iOS Safari or a Jellyfin Web wrapper before claiming that client as supported.

1. In Single Page at 100%, pinch outward and confirm the page follows the two-finger gesture smoothly, then releases to a toolbar zoom between 50% and 400%.
2. Close and reopen the reader and confirm the final pinch zoom is restored through the per-user preference bridge.
3. Pinch inward/outward and release without crossing a 5% normalized zoom step; confirm an existing one-finger pan offset above 100% is not reset.
4. Complete a pinch with a large horizontal component and confirm releasing the fingers does not turn the page.
5. Add a third finger during a pinch; confirm the original two-finger pair remains authoritative and zoom does not jump.
6. With a third finger still down, lift either original pinch finger; confirm the pinch ends cleanly rather than switching to a different pair.
7. Start with two fingers closer than the minimum pinch distance, spread them apart, and confirm the gesture can become a pinch without creating a page-turn tap/swipe.
8. At greater than 100% zoom, confirm ordinary one-finger drag-to-pan still works after the pinch finishes.
9. In Vertical Continuous and Webtoon, confirm one-finger vertical scrolling remains native, then add a second finger and pinch in/out; zoom should change while the page/scroll position stays anchored, and releasing the gesture must not create a page jump.
10. In paged Fit Width/Original at 100% or below, confirm normal vertical panning/scrolling remains usable where content exceeds the viewport; the pinch feature must not globally force `touch-action:none`.

The JavaScript Injector integration is optional at runtime and loaded by reflection. Do not add its assembly or Newtonsoft.Json as a compile/runtime dependency to Advanced Books.

Advanced Books registers each embedded reader bridge as a separate JS Injector entry. Keep each individual reader JavaScript asset below 96 KiB UTF-8; CI and release validation enforce this defensive boundary. The runtime loader also uses strict UTF-8 decoding, rejects unexpected control characters, removes the legacy combined registration, and rolls back all Advanced Books registrations if any split entry fails.

## Coding rules

- Keep Jellyfin-specific types out of `Jellyfin.AdvancedBooks.Core`.
- Add tests for path parsing, ordering, archive edge cases, progress conversion and reader preference validation.
- Run `node --check` on every embedded reader script after modifications.
- Keep multi-touch handling isolated from the base reader unless a shared reader API is deliberately introduced.
- Do not globally disable native touch scrolling merely to make pinch handling easier.
- Never use client-provided filesystem paths in HTTP APIs.
- Validate client-provided page indexes against server-side archive metadata before persisting them.
- Validate reader preference values on the server even when the Web client also normalizes them.
- Do not add an arbitrary user-id parameter to per-user preference APIs.
- Bound user-selectable cache variants and concurrent thumbnail generation.
- Prefer streaming over buffering full comic archives.
- Revoke browser Blob URLs when evicting pages or closing the reader.
- Abort navigator thumbnail requests when the navigator closes.
- Preserve the user's source files; metadata writes must be explicit opt-in behavior if introduced.
- Keep UI integration isolated from server-domain logic.

## Updating Jellyfin dependencies

Jellyfin plugin ABI changes can be breaking. Update `Jellyfin.Controller`, `Jellyfin.Model`, `Jellyfin.Naming`, `build.yaml`'s `targetAbi`, and the target framework together, then run unit and integration tests.

The progress mapping must also be rechecked whenever Jellyfin Web changes `ComicsPlayer.currentTime()`, `startPositionTicks`, or playbackmanager's millisecond/tick conversion. Thumbnail generation must be rechecked if Jellyfin changes `IImageProcessor`, `ImageProcessingOptions`, or supported output formats. Preference persistence must be rechecked if Jellyfin changes `IDisplayPreferencesManager` or custom item display-preference semantics. Touch handling must be rechecked if Jellyfin Web changes reader-stage `touch-action` behavior or pointer-event handling.

## Pull requests

Keep changes focused. A feature that changes resolver behavior should include fixture-style tests and document any intentional difference from Komga. Reader changes should document which Jellyfin Web selectors or globals they depend on and should remain safe when the integration plugin is absent.
