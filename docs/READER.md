# Advanced Reader

The Advanced Reader is a client-side overlay backed by Advanced Books' authenticated per-page API. It is separated from scanner/archive code so Jellyfin Web integration can evolve without changing the media pipeline.

## Current modes

Four reading modes are available for CBZ/ZIP-backed Jellyfin Book items:

- **Single page** - one page at a time;
- **Double page** - RTL/LTR smart spreads; first/last pages and detected landscape pages remain single, with page orientation resolved before the spread is committed to the DOM;
- **Vertical continuous** - independent comic pages stacked vertically;
- **Webtoon** - edge-to-edge continuous vertical reading with zero gap by default and optional page-gap/side-padding tuning.

All four modes support Fit Screen, Fit Width, Fit Height and Original Size plus 50%-400% reader zoom. Paged modes retain click/tap zones, horizontal swipe, keyboard navigation and drag-to-pan. Vertical Continuous and Webtoon retain native one-finger/mouse-wheel scrolling; their zoom changes the continuous canvas width so high zoom can be panned with normal scrolling/touch or desktop drag panning.

## Zoom and touch gestures

All four layouts use a single Reader-owned 50%-400% zoom state. Toolbar + / − / reset, keyboard + / − / 0, Ctrl+wheel, double-tap, persisted preference restore, and pinch all call the same Reader `setZoom` operation.

Reusable coordinate math lives in `Reader/advancedBooksZoom.js`, while `Reader/advancedBooksGestures.js` only interprets input. Gestures no longer replaces the Reader's `setZoom` or `applyTransform` methods. The Zoom Geometry bridge is registered before Reader Core and is required at runtime.

For a pinch, each animation frame preserves the content point under the previously rendered two-finger midpoint and moves it to the new midpoint while applying the new scale. Paged layouts clamp pan to the actual rendered image/spread during both zoom and later drag. Vertical Continuous and Webtoon anchor to the actual image under the fingers when possible and fall back to its page slot only for surrounding whitespace.

Fit Screen in continuous modes scales both canvas width and the image-height cap with Reader zoom. Fit Width, Fit Height, and Original Size use the same focal-point restoration path. At normal zoom, continuous reading retains native one-finger scrolling. Above 100%, one-finger custom pan is available when Touch gestures is enabled. Turning Touch gestures off immediately restores native two-axis browser panning.

A completed multi-touch gesture suppresses its trailing pointer-up events so it cannot become an accidental page turn. Ending either original pinch pointer ends the active pair rather than silently switching to a third finger.

## Reader chrome and direct page navigation

The visual baseline is the **v0.16.1.0 Reader UI**. Desktop uses the centered compact bottom pill, while narrow/mobile viewports use the floating rounded top/bottom chrome. On mobile, Fullscreen and Help remain grouped under the compact **…** menu; Close, metadata, Pages, and Settings remain directly accessible. These surfaces are intentional and must not be replaced by the older full-width Reader shell.

The v0.16.1 presentation rules live in the Preferences bridge, while Core also owns lower-level Reader styles. Because `advancedbooks:reader-opening` is emitted before Core creates its stylesheet, Preferences re-appends its existing presentation stylesheet after the Reader overlay appears. This preserves the exact v0.16.1 values while ensuring Core's base rules cannot partially overwrite the pill geometry, mobile floating chrome, or More-menu visibility.

The reader UI auto-hides while reading. The bottom navigation has two states: while controls are active it shows Previous/Next, the scrubber, and page position; after inactivity it collapses to the current page/range pill while the thin progress rail remains visible. Desktop pointer movement uses an intentional-movement threshold so hardware jitter does not reopen controls. Active pressing, dragging, scrubbing, scrolling controls, focused Reader controls, and open Settings/Help/More/Pages surfaces suspend auto-hide.

The bottom strip is available in Single, Double, Vertical Continuous, and Webtoon modes. Pressing or dragging the range scrubber opens a thumbnail preview positioned from the real pointer/finger location. Stale requests are aborted, 128px previews are used for fast display, and a bounded browser cache avoids repeatedly generating the same preview.

The top chrome shows Jellyfin book metadata: title plus available authors, series, issue/index, and production year. Metadata can be disabled or configured field-by-field. Optional auto-scroll reveals long values without changing the surrounding chrome geometry.

Settings use a fixed panel shell with a non-scrolling header and independently scrollable body. Desktop uses a compact floating panel; narrow/mobile layouts use a resizable bottom sheet with a real drag handle. Reader Help uses the same fixed-shell approach with Navigation, Zoom & pan, and Reader groups.

Reading-surface navigation follows the selected layout. Single/Double Page use left/right click or tap zones with a short directional transition and a center zone that toggles controls. Vertical Continuous and Webtoon use top/bottom zones to move to the previous/next tracked page with smooth scrolling, while the center toggles controls. Reduced-motion users receive immediate movement.

Desktop mouse interaction follows image-viewer conventions. Vertical/Webtoon can be grabbed and scrolled, and paged modes can be dragged when zoomed or when the fit produces a scrollable canvas. Paged drag uses the same rendered-content clamp as focal zoom, including after viewport resize or device rotation.


## Localization

The Advanced Reader follows Jellyfin Web's document language by default, with the browser language as a fallback. Users can override that automatic choice from Reader Settings and persist Auto, English, Japanese, German, French, Spanish or Simplified Chinese per Jellyfin user. Unsupported automatic locales fall back to English.

Localization is isolated in `Reader/advancedBooksLocalization.js` so the already size-constrained Core reader does not grow with translation tables. The bridge translates Advanced Books-owned controls, labels, tooltips and accessibility labels while preserving user-provided book metadata. Stable `data-ab-action` identifiers keep Preferences and Gestures functional even after visible titles are translated.

## Per-user reader preferences

Advanced Books stores global reader controls in Jellyfin's normal display-preferences database rather than a plugin-owned JSON file.

```text
GET /AdvancedBooks/Reader/Preferences
PUT /AdvancedBooks/Reader/Preferences
```

The following settings are persisted for the current authenticated Jellyfin user:

- layout: Single / Double / Vertical Continuous / Webtoon;
- reading direction: RTL / LTR;
- fit mode: Screen / Width / Height / Original;
- reader zoom: 50%-400%;
- continuous side padding: 0%, 2%, 5%, 10%, 15% or 20%; and
- continuous page gap: 0, 4, 8, 12, 16, 24 or 32 pixels;
- reader background: Black / Gray / White;
- paged transition animation: On / Off; and
- touch gestures: On / Off;
- metadata header: Show / Hide;
- title, authors, series, issue/index and year: individually Show / Hide; and
- metadata auto-scroll: On / Off;
- bottom page/range position: Show / Hide; and
- reader UI language: Auto (Jellyfin), English, Japanese, German, French, Spanish or Simplified Chinese.

Preferences use a fixed Advanced Books display-preference namespace, so the same Jellyfin user receives the same reader controls in another Jellyfin Web browser/client. Different Jellyfin users remain isolated.

Reading-position resume is intentionally completed first. The progress bridge then emits `advancedbooks:progress-ready`, after which the preference bridge restores layout, direction, fit and zoom. The current reader exposes a direct session jump API, so distant resume positions no longer need to flash through a temporary continuous layout.

Preference changes are debounced. If another change occurs while a PUT is in flight, only the newest value is queued and written afterward. Reader close attempts to flush that queued final state; a failed save does not create an automatic retry loop.

## Thumbnail page navigator

The reader toolbar exposes a **Pages** button. It opens a side panel containing page thumbnails, highlights the currently visible page or spread, and lets the reader jump directly to any page.

The navigator does not fetch every original page. Thumbnail cards are observed with an `IntersectionObserver`, and only thumbnails near the navigator viewport are requested. Browser Blob URLs are bounded and distant entries are revoked.

Thumbnail endpoint:

```text
GET /AdvancedBooks/Books/{itemId}/Pages/{pageIndex}/Thumbnail?width=128
```

The server accepts widths from 96 through 320 pixels and normalizes requests into five bounded cache widths: 96, 128, 180, 240 and 320. It opens only the validated target archive page, writes that page to a temporary work file, and passes the file through Jellyfin's `IImageProcessor`. Only WebP/JPEG/PNG outputs are accepted. The plugin-owned resized file is retained; the full-resolution work file and image-processor intermediate are deleted after processing.

Cache keys include archive size and modification time plus page identity and requested cache width, so changing a CBZ invalidates the old thumbnail version without modifying source media. Thumbnail generation is limited to two concurrent operations to reduce CPU and memory spikes when a large magazine navigator is opened.

Direct page jumps call the live reader session directly, so the thumbnail navigator can reach a distant page without temporarily switching the user's layout.

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

This is intentional. Jellyfin's standard ComicsPlayer restores its page with `startPositionTicks / 10,000`, so the standard and Advanced readers share the same authoritative resume position in both directions. A page saved by the built-in reader is therefore the page Advanced Reader restores next, and a page saved by Advanced Reader is the position the built-in reader receives on its next launch.

Generic Home/Library card, list and keyboard/remote **Play** actions intentionally enter Advanced Reader through the resume path and ask the server for that shared position instead of trusting a potentially stale `data-positionticks` value left in the current Jellyfin Web DOM. With no saved position this still opens page 1. Explicit Replay/Start-over/Play-from-beginning actions remain explicit resets to page 1.

The browser progress bridge observes the Advanced Reader's page counter. After navigation settles for about 1.2 seconds it saves the furthest visible page. The reader also emits a close event before removing its DOM, allowing the bridge to capture the final reached page; if an earlier PUT is still in flight, only the newest position is queued and sent immediately afterward. In Double Page mode the furthest page in the current smart spread is considered reached. Vertical/Webtoon modes use the viewport-tracked current page.

When opening a book, the saved server-side position is restored before reader preferences are applied, even when Jellyfin already marks the Book played. The current integration jumps directly through the live reader session, then signals the preferences bridge. This avoids issuing hundreds of sequential Next operations or temporarily changing layouts for a large magazine.

Reaching the final page marks the Jellyfin Book as played. Completion is server-authoritative: clients submit only a page index, and the server checks that it is the actual final page. Non-final progress writes intentionally leave the existing `Played` value unchanged; this means opening a previously completed book for a reread does not silently mark it unread.

## Continuous lazy loading

Continuous mode creates lightweight page placeholders but does **not** download every image. Each page slot has a strict DOM invariant: it contains exactly one placeholder or exactly one image for that page. Observer loading, directional prefetch and direct jumps may request the same page concurrently, but successful loads replace the slot content instead of appending another image. A per-slot load generation prevents an older asynchronous request from restoring an image after the slot has been evicted or reset.

Two `IntersectionObserver`s are rooted to the reader viewport:

1. a prefetch observer begins authenticated page loading only when a placeholder enters an expanded area around the viewport; and
2. a visibility observer tracks which page occupies the viewport and updates the current page counter.

Nearby pages are kept in memory. Continuous mode has a bounded Blob cache and evicts distant pages, revoking their object URLs and returning the page to a lightweight placeholder. Distant in-flight requests are aborted as the reading position moves. The invariant above prevents the former race where the initial load, observer and prefetch paths could each create a copy of the same `<img>` and leave duplicate images side-by-side in the flex page slot.

This keeps a large magazine or manga volume from turning into a full-archive browser download while still allowing smooth continuous scrolling.

## Jellyfin Web integration

For Jellyfin 12, Advanced Books can integrate with the community JavaScript Injector plugin. At server startup, Advanced Books discovers `Jellyfin.Plugin.JavaScriptInjector` by reflection and registers Localization, Core, Progress, Preferences, Navigator, Gestures and Jellyfin Integration as seven independent validated entries through that plugin's public `PluginInterface.RegisterScript` contract.

The Jellyfin Integration bridge keeps route/history and host-UI behavior outside the size-constrained Core reader. Opening Advanced Reader pushes a same-page history entry, so browser Back and Android/browser back gestures close the overlay and reveal the exact Jellyfin screen underneath. Closing the reader normally consumes that synthetic history entry instead of navigating away from the detail page.

When **Use Advanced Reader for Jellyfin book actions** is enabled, supported CBZ/ZIP items reuse Jellyfin's normal Book actions across the Web UI rather than only on the legacy detail page. The integration covers legacy detail Play/Resume/Replay buttons, the modern `.btnPlayOrResume` action, Home/Library card Play buttons, list-view Play/Resume buttons, keyboard/remote `play` and `resume` commands, and item-context-menu Play/Resume commands. The Core reader exposes a direct item-opening API so those surfaces no longer depend on a separately rendered **Advanced Reader** detail button.

Resume restores the shared Jellyfin `UserItemData` progress used by both the built-in ComicsPlayer and Advanced Reader. Explicit Start/Replay actions deliberately skip restore and open page 1; generic card/list/remote Play actions query the server-side shared progress even when the current card DOM has stale or missing playback ticks. Unsupported/inaccessible/non-CBZ/ZIP items fall back to the original Jellyfin action instead of being blocked.

The same bridge replaces the previous/next text glyphs with centered inline SVG chevrons and hides the duplicate visual top page counter while retaining that counter in the DOM for progress synchronization.

This is an optional runtime integration. Advanced Books does not reference or ship JavaScript Injector assemblies, and the server-side One-Shot/page/progress/preferences/thumbnail APIs continue to work without it.

The injected reader watches Jellyfin Web item-detail navigation and probes:

```text
GET /AdvancedBooks/Books/{itemId}/Pages
```

Only a supported, accessible archive with at least one page receives an **Advanced Reader** button.

## Page loading

Image elements cannot attach Jellyfin's custom authorization header directly. Full pages and thumbnail images are therefore requested through Jellyfin's authenticated `ApiClient.fetch(...)`, converted to temporary Blob URLs and then assigned to images. Full-page requests use an archive-version query key and `no-store`; the server returns `X-AdvancedBooks-Page-Index`, which the reader checks before accepting the bytes. The complete CBZ is never intentionally downloaded by the Advanced Reader.

## Controls

| Input | Paged modes | Continuous / Webtoon |
| --- | --- | --- |
| Escape | Close settings/help, then reader | Close settings/help, then reader |
| Arrow Left / Right | Direction-aware previous/next | Native/no reader action |
| Arrow Up / Down | Native | Previous/next page |
| Page Up / Page Down | Previous/next group | Previous/next page |
| Space | Next group | Next page |
| Home / End | First/last page | First/last page |
| F | Toggle fullscreen when supported | Toggle fullscreen when supported |
| + / - / 0 | Reader zoom | Reader zoom |
| Left/right click or tap | Direction-aware previous/next with directional transition | Center toggles controls |
| Top/bottom click or tap | Center toggles controls | Previous/next tracked page with smooth scrolling |
| Horizontal swipe | Direction-aware navigation | Native scrolling |
| Two-finger pinch | 50%-400% focal-point zoom around the pinch location | 50%-400% focal-point zoom around the pinch location |
| Double tap | Zoom the tapped area to 200%; double tap again to restore the previous/base view | Same |
| Wheel | Previous/next in Fit Screen; focal zoom while already zoomed | Native vertical scroll |
| Ctrl+wheel | Focal zoom around the pointer | Focal zoom around the pointer |
| Mouse drag | Pan when zoomed or when the paged canvas overflows | Grab-scroll the continuous/Webtoon canvas at any zoom |
| One-finger drag at >100% | Pan | Pan the zoomed continuous/Webtoon canvas |
| Bottom page scrubber | Direct page jump + thumbnail preview | Direct page jump + thumbnail preview |
| Pages button | Open thumbnail navigator | Open thumbnail navigator |

## Compatibility boundary

The injected UI is intended for Jellyfin Web and clients that wrap Jellyfin Web. Native clients with their own UI, such as Android TV clients, do not receive the injected reader.

The route/DOM adapter remains isolated inside `Reader/advancedBooksReader.js`, progress persistence is isolated in `Reader/advancedBooksProgress.js`, preference persistence is isolated in `Reader/advancedBooksPreferences.js`, page navigation is isolated in `Reader/advancedBooksNavigator.js`, multi-touch handling is isolated in `Reader/advancedBooksGestures.js`, and Jellyfin host/history integration is isolated in `Reader/advancedBooksIntegration.js`. If Jellyfin changes the item-details or reader DOM, the integration layer can be replaced without changing archive or storage APIs.

## Not implemented yet

- additional mobile polish after live device testing;
- CBR/PDF/EPUB Advanced Reader pipelines;
- live end-to-end browser tests against a running Jellyfin 12 instance.
