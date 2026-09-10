# Advanced Reader

The Advanced Reader is a client-side overlay backed by Advanced Books' authenticated per-page API. It is separated from scanner/archive code so Jellyfin Web integration can evolve without changing the media pipeline.

## Current modes

Four reading modes are available for CBZ/ZIP-backed Jellyfin Book items:

- **Single page** - one page at a time;
- **Double page** - two-page spreads with RTL/LTR ordering;
- **Vertical continuous** - independent comic pages stacked vertically;
- **Webtoon** - edge-to-edge continuous vertical pages with no page gap.

Paged modes support Fit Screen, Fit Width, Fit Height and Original Size, 50%-400% zoom, drag-to-pan, click/tap zones, horizontal swipe, keyboard navigation and fit-screen wheel navigation.

Vertical Continuous supports the fit modes at 100% reader zoom. Webtoon is intentionally locked to Fit Width. Continuous modes use normal vertical mouse/touch scrolling; reader-level zoom/pan is disabled there for now to avoid fighting native scrolling and pinch gestures.

## Continuous lazy loading

Continuous mode creates lightweight page placeholders but does **not** download every image. Two `IntersectionObserver`s are rooted to the reader viewport:

1. a prefetch observer begins authenticated page loading only when a placeholder enters an expanded area around the viewport; and
2. a visibility observer tracks which page occupies the viewport and updates the current page counter.

Nearby pages are kept in memory. Continuous mode has a bounded Blob cache and evicts distant pages, revoking their object URLs and returning the page to a lightweight placeholder. Distant in-flight requests are aborted as the reading position moves.

This keeps a large magazine or manga volume from turning into a full-archive browser download while still allowing smooth continuous scrolling.

## Jellyfin Web integration

For Jellyfin 12, Advanced Books can integrate with the community JavaScript Injector plugin. At server startup, Advanced Books discovers `Jellyfin.Plugin.JavaScriptInjector` by reflection and registers its embedded reader script through that plugin's public `PluginInterface.RegisterScript` contract.

This is an optional runtime integration. Advanced Books does not reference or ship JavaScript Injector assemblies, and the server-side One-Shot resolver/page API continue to work without it.

The injected script watches Jellyfin Web item-detail navigation and probes:

```text
GET /AdvancedBooks/Books/{itemId}/Pages
```

Only a supported, accessible archive with at least one page receives an **Advanced Reader** button.

## Page loading

Image elements cannot attach Jellyfin's custom authorization header directly. Pages are therefore requested through Jellyfin's authenticated `ApiClient.fetch(...)`, converted to temporary Blob URLs and then assigned to images. The complete CBZ is never intentionally downloaded by the Advanced Reader.

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
| Wheel | Previous/next in Fit Screen | Native vertical scroll |
| Ctrl+wheel | Reader zoom | Browser/native behavior |
| Drag at >100% | Pan | Native scrolling |

## Compatibility boundary

The injected UI is intended for Jellyfin Web and clients that wrap Jellyfin Web. Native clients with their own UI, such as Android TV clients, do not receive the injected reader.

The route/DOM adapter remains isolated inside `Reader/advancedBooksReader.js`. If Jellyfin changes the item-details DOM, only that adapter should require adjustment.

## Not implemented yet

- thumbnail/page navigator;
- persisted per-user reader preferences;
- Jellyfin reading-position synchronization/resume;
- mark-completed behavior;
- dedicated pinch-zoom behavior;
- CBR/PDF/EPUB Advanced Reader pipelines.
