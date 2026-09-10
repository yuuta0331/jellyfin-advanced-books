# Advanced Reader

The Advanced Reader is a client-side overlay backed by Advanced Books' authenticated per-page API. It is separated from scanner/archive code so Jellyfin Web integration can evolve without changing the media pipeline.

## Current modes

Four reading modes are available for CBZ/ZIP-backed Jellyfin Book items:

- **Single page** - one page at a time;
- **Double page** - two-page spreads with RTL/LTR ordering;
- **Vertical continuous** - independent comic pages stacked vertically;
- **Webtoon** - edge-to-edge continuous vertical pages with no page gap.

All four modes support Fit Screen, Fit Width, Fit Height and Original Size plus 50%-400% reader zoom. Paged modes retain click/tap zones, horizontal swipe, keyboard navigation and drag-to-pan. Vertical Continuous and Webtoon retain native one-finger/mouse-wheel scrolling; their zoom changes the continuous canvas width so high zoom can be panned with normal scrolling/touch or desktop drag panning.

## Touch pinch zoom

Single Page and Double Page modes support dedicated two-finger pinch-to-zoom from 50% through 400%. The gesture bridge is isolated in `Reader/advancedBooksGestures.js` so touch behavior can evolve without coupling it to archive loading or persistence.

The first touch remains available to the reader's existing tap/swipe behavior. Once a second touch establishes a multi-touch gesture, single-pointer handling is suppressed until all participating touches are released. Extra fingers are also isolated from the reader's single-pointer state, and ending either of the two original pinch pointers ends that pinch rather than silently switching to a different finger pair.

During the gesture, the page container receives a temporary smooth scale/translation preview based on finger distance and midpoint. On release, that preview is removed and the normalized 5% zoom value is committed through the reader's existing Reset/Zoom/Ctrl+wheel controls. This keeps the reader-owned transform, toolbar percentage and per-user preference bridge synchronized instead of maintaining a second zoom state.

If the gesture rounds back to its starting zoom, the bridge leaves the committed reader state untouched so an existing drag-to-pan offset above 100% is preserved. A completed multi-touch gesture suppresses its final pointer-up events to prevent an accidental page turn.

Vertical Continuous and Webtoon also use the custom pinch bridge. One-finger vertical scrolling remains native, while a second touch commits the gesture to reader zoom. On release the normalized zoom value is persisted through the same reader preference bridge as the toolbar controls.

The committed paged zoom recenters using the reader's normal transform; midpoint translation is currently a live preview rather than a persisted pan offset. After zooming above 100%, normal one-finger drag-to-pan remains available.

## Reader chrome and direct page navigation

The reader UI is optimized to disappear while reading. A compact top chrome and bottom navigation strip are shown when the reader opens, then auto-hide after inactivity. Pointer movement on desktop or a center tap/click restores them. Opening Reader Settings pins the chrome open until the sheet is closed.

The bottom strip is available in Single, Double, Vertical Continuous and Webtoon modes. It contains Previous/Next controls, the current page/range, and a range scrubber for direct jumps across long books. A thin progress rail remains visible at the bottom edge even when the larger controls are hidden.

Settings no longer occupy a permanent toolbar row. Desktop uses a compact floating settings panel; narrow/mobile layouts use a bottom sheet with touch-sized controls. Layout, paged direction, fit and zoom remain available from the same sheet.

## Per-user reader preferences

Advanced Books stores global reader controls in Jellyfin's normal display-preferences database rather than a plugin-owned JSON file.

```text
GET /AdvancedBooks/Reader/Preferences
PUT /AdvancedBooks/Reader/Preferences
```

The following settings are persisted for the current authenticated Jellyfin user:

- layout: Single / Double / Vertical Continuous / Webtoon;
- reading direction: RTL / LTR;
- fit mode: Screen / Width / Height / Original; and
- paged zoom: 50%-400%.

Preferences use a fixed Advanced Books display-preference namespace, so the same Jellyfin user receives the same reader controls in another Jellyfin Web browser/client. Different Jellyfin users remain isolated.

Reading-position resume is intentionally completed first. The progress bridge then emits `advancedbooks:progress-ready`, after which the preference bridge restores layout, direction, fit and zoom. This prevents a saved layout from interrupting the temporary continuous-mode jump used for distant resume positions.

Preference changes are debounced. If another change occurs while a PUT is in flight, only the newest value is queued and written afterward. Reader close attempts to flush that queued final state; a failed save does not create an automatic retry loop.

## Thumbnail page navigator

The reader toolbar exposes a **Pages** button. It opens a side panel containing page thumbnails, highlights the currently visible page or spread, and lets the reader jump directly to any page.

The navigator does not fetch every original page. Thumbnail cards are observed with an `IntersectionObserver`, and only thumbnails near the navigator viewport are requested. Browser Blob URLs are bounded and distant entries are revoked.

Thumbnail endpoint:

```text
GET /AdvancedBooks/Books/{itemId}/Pages/{pageIndex}/Thumbnail?width=180
```

The server accepts widths from 96 through 320 pixels and normalizes requests into five bounded cache widths: 96, 128, 180, 240 and 320. It opens only the validated target archive page, writes that page to a temporary work file, and passes the file through Jellyfin's `IImageProcessor`. Only WebP/JPEG/PNG outputs are accepted. The plugin-owned resized file is retained; the full-resolution work file and image-processor intermediate are deleted after processing.

Cache keys include archive size and modification time plus page identity and requested cache width, so changing a CBZ invalidates the old thumbnail version without modifying source media. Thumbnail generation is limited to two concurrent operations to reduce CPU and memory spikes when a large magazine navigator is opened.

Direct page jumps reuse the continuous page-slot model to reach a distant page efficiently. The navigator waits until the reader page counter confirms the target before returning to the user's prior layout.

## Reading progress and resume

Advanced Books stores progress in Jellyfin's normal per-user `UserItemData`, not in a plugin-owned database.

```text
GET /AdvancedBooks/Books/{itemId}/Progress
PUT /AdvancedBooks/Books/{itemId}/Progress
```

The stored `PlaybackPositionTicks` follows Jellyfin Web's built-in ComicsPlayer convention:

```text
playbackPositionTicks = zeroBasedPageIndex * 10,000
```

This is intentional. Jellyfin's standard ComicsPlayer restores its page with `startPositionTicks / 10,000`, so the standard and Advanced readers can share the same resume position.

The browser progress bridge observes the Advanced Reader's page counter. After navigation settles for about 1.2 seconds it saves the furthest visible page, and it also attempts a final flush when the reader closes. In Double Page mode the second visible page is considered the reached page. Vertical/Webtoon modes use the viewport-tracked current page.

When opening an unfinished book, the saved server-side position is restored before reader preferences are applied. The current integration temporarily uses the continuous page-slot model to jump directly to a distant saved page, then returns to the initial layout and signals the preferences bridge. This avoids issuing hundreds of sequential Next operations for a large magazine.

Reaching the final page marks the Jellyfin Book as played. Completion is server-authoritative: clients submit only a page index, and the server checks that it is the actual final page. Non-final progress writes intentionally leave the existing `Played` value unchanged; this means opening a previously completed book for a reread does not silently mark it unread.

## Continuous lazy loading

Continuous mode creates lightweight page placeholders but does **not** download every image. Two `IntersectionObserver`s are rooted to the reader viewport:

1. a prefetch observer begins authenticated page loading only when a placeholder enters an expanded area around the viewport; and
2. a visibility observer tracks which page occupies the viewport and updates the current page counter.

Nearby pages are kept in memory. Continuous mode has a bounded Blob cache and evicts distant pages, revoking their object URLs and returning the page to a lightweight placeholder. Distant in-flight requests are aborted as the reading position moves.

This keeps a large magazine or manga volume from turning into a full-archive browser download while still allowing smooth continuous scrolling.

## Jellyfin Web integration

For Jellyfin 12, Advanced Books can integrate with the community JavaScript Injector plugin. At server startup, Advanced Books discovers `Jellyfin.Plugin.JavaScriptInjector` by reflection and registers the embedded reader, progress, preferences, navigator and gesture scripts as one combined injection payload through that plugin's public `PluginInterface.RegisterScript` contract.

This is an optional runtime integration. Advanced Books does not reference or ship JavaScript Injector assemblies, and the server-side One-Shot/page/progress/preferences/thumbnail APIs continue to work without it.

The injected reader watches Jellyfin Web item-detail navigation and probes:

```text
GET /AdvancedBooks/Books/{itemId}/Pages
```

Only a supported, accessible archive with at least one page receives an **Advanced Reader** button.

## Page loading

Image elements cannot attach Jellyfin's custom authorization header directly. Full pages and thumbnail images are therefore requested through Jellyfin's authenticated `ApiClient.fetch(...)`, converted to temporary Blob URLs and then assigned to images. The complete CBZ is never intentionally downloaded by the Advanced Reader.

## Controls

| Input | Paged modes | Continuous / Webtoon |
| --- | --- | --- |
| Escape | Close | Close |
| Arrow Left / Right | Direction-aware previous/next | Native/no reader action |
| Arrow Up / Down | Native | Previous/next page |
| Page Up / Page Down | Previous/next group | Previous/next page |
| Space | Next group | Next page |
| Home / End | First/last page | First/last page |
| + / - / 0 | Zoom | Disabled |
| Left/right click or tap | Direction-aware navigation | Native scrolling |
| Horizontal swipe | Direction-aware navigation | Native scrolling |
| Two-finger pinch | 50%-400% reader zoom | 50%-400% reader zoom |
| Wheel | Previous/next in Fit Screen | Native vertical scroll |
| Ctrl+wheel | Reader zoom | Reader zoom |
| Drag at >100% | Pan | Desktop drag pan; native touch/scroll pan |
| Bottom page scrubber | Direct page jump | Direct page jump |
| Pages button | Open thumbnail navigator | Open thumbnail navigator |

## Compatibility boundary

The injected UI is intended for Jellyfin Web and clients that wrap Jellyfin Web. Native clients with their own UI, such as Android TV clients, do not receive the injected reader.

The route/DOM adapter remains isolated inside `Reader/advancedBooksReader.js`, progress persistence is isolated in `Reader/advancedBooksProgress.js`, preference persistence is isolated in `Reader/advancedBooksPreferences.js`, page navigation is isolated in `Reader/advancedBooksNavigator.js`, and multi-touch handling is isolated in `Reader/advancedBooksGestures.js`. If Jellyfin changes the item-details or reader DOM, the integration layer can be replaced without changing archive or storage APIs.

## Not implemented yet

- focal-point pan persistence across pinch release;
- additional mobile polish after live device testing;
- CBR/PDF/EPUB Advanced Reader pipelines;
- live end-to-end browser tests against a running Jellyfin 12 instance.
