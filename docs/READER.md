# Advanced Reader

The Advanced Reader is a client-side overlay backed by Advanced Books' authenticated page API. It is intentionally separated from the archive scanner and page-serving code so Jellyfin Web integration can evolve without changing the media pipeline.

## Current feature set

The first reader milestone supports CBZ/ZIP-backed Jellyfin Book items and provides:

- single-page and double-page layouts;
- right-to-left and left-to-right navigation;
- fit screen, fit width, fit height and original-size modes;
- zoom from 50% to 400%;
- drag-to-pan while zoomed;
- mouse/touch click zones;
- horizontal swipe navigation;
- keyboard navigation;
- wheel page navigation in fit-screen mode;
- Ctrl+wheel zoom;
- bounded object-URL cache and nearby-page prefetch;
- a full-window reader overlay that does not modify the source book.

Vertical continuous reading, Webtoon mode, thumbnails and Jellyfin progress synchronization are not part of this milestone.

## Jellyfin Web integration

Jellyfin does not currently expose a stable general-purpose server-plugin API for replacing arbitrary Web UI components. The reader therefore treats Web integration as a replaceable adapter.

For Jellyfin 12, Advanced Books can integrate with the community JavaScript Injector plugin. At server startup, Advanced Books discovers `Jellyfin.Plugin.JavaScriptInjector` by reflection and registers its embedded reader script through that plugin's public `PluginInterface.RegisterScript` contract.

This is an optional runtime integration:

- Advanced Books does not reference or ship JavaScript Injector assemblies;
- the server-side One-Shot resolver and page API work without it;
- when JavaScript Injector is absent, no Web reader button is injected;
- disabling **Enable Advanced Reader integration** causes Advanced Books to unregister its reader script on startup.

The registration payload is constructed through reflection so Advanced Books does not take a compile-time dependency on Newtonsoft.Json or JavaScript Injector internals.

## Reader discovery

The injected script watches Jellyfin Web item-detail navigation. It obtains the current item ID from the route and probes:

```text
GET /AdvancedBooks/Books/{itemId}/Pages
```

Only when that endpoint succeeds and reports one or more pages does the script add an **Advanced Reader** button to the visible `.mainDetailButtons` container. Unsupported formats, inaccessible books and rejected archives therefore do not expose a broken reader action.

## Page loading

Image elements cannot attach Jellyfin's custom authorization header directly. The reader therefore requests each page with Jellyfin's authenticated `ApiClient.fetch(...)`, converts the response to a Blob URL, and assigns that local URL to the image element.

The reader prefetches nearby pages and retains at most eight Blob URLs. Evicted and closed-reader Blob URLs are revoked.

## Controls

Default controls:

| Input | Action |
| --- | --- |
| Escape | Close reader |
| Arrow Left / Right | Direction-aware page navigation |
| Page Up / Page Down | Previous / next page group |
| Space | Next page group |
| Home / End | First / last page |
| + / - / 0 | Zoom in / out / reset |
| Click/tap left or right half | Direction-aware navigation |
| Horizontal swipe | Direction-aware navigation |
| Wheel | Previous/next in Fit Screen at 100% |
| Ctrl+wheel | Zoom |
| Drag while zoomed | Pan |

## Compatibility boundary

The injected UI is expected to work in Jellyfin Web and clients that wrap Jellyfin Web. Native clients with their own UI, such as Android TV clients, do not receive the injected reader.

The selector and route adapter are deliberately isolated inside `Reader/advancedBooksReader.js`. If Jellyfin changes the item-details DOM or navigation model, only this adapter should need adjustment.
