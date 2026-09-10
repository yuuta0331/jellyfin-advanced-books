# Pinch zoom behavior

The Advanced Reader has a dedicated touch gesture bridge for two-finger pinch zoom in reader modes.

## Scope

- Enabled in **Single Page**, **Double Page**, **Vertical Continuous**, and **Webtoon** modes.
- Continuous layouts keep native one-finger vertical scrolling; the reader pinch bridge takes over only once a second touch establishes a multi-touch gesture.
- Zoom is bounded to **50%-400%**, matching the reader and persisted preference range.
- The final value is normalized to the same 5% grid used by reader preferences.

## Gesture handling

The first touch remains available to the reader's existing tap/swipe behavior. As soon as a second touch appears, the gesture bridge exclusively owns pointer movement until all touches are released. A valid pinch begins once the finger distance reaches the minimum threshold.

During the pinch, the page container receives a temporary scale preview anchored at the initial pinch point. The preview does not translate the page with midpoint movement and does not directly mutate persisted reader state. Once the second touch arrives, the base reader's single-pointer state is cancelled; Continuous/Webtoon also hold the captured scroll position stable until the gesture ends.

When the gesture ends, the temporary transform is removed and the final zoom is committed through the live reader session's zoom API. The older Reset/Zoom/Ctrl+wheel bridge remains only as a compatibility fallback. This keeps the reader's internal zoom value, the toolbar percentage, and the per-user preference bridge synchronized rather than maintaining a second independent zoom state.

Both final pointer-up events are suppressed after a pinch so the original first touch cannot accidentally become a page-turn swipe.

## Current limitation

The committed zoom uses the reader's normal transform/sizing path. Pinch midpoint translation is intentionally not used, so zooming does not drag the page around with finger midpoint movement. After zooming above 100%, paged modes retain one-finger drag-to-pan. Continuous/Webtoon keep native touch scrolling and also support desktop drag panning.
