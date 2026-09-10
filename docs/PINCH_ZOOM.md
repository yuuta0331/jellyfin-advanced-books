# Pinch zoom behavior

The Advanced Reader has a dedicated touch gesture bridge for two-finger pinch zoom in paged modes.

## Scope

- Enabled in **Single Page** and **Double Page** modes.
- Disabled in **Vertical Continuous** and **Webtoon** modes so native vertical scrolling remains predictable.
- Zoom is bounded to **50%-400%**, matching the reader and persisted preference range.
- The final value is normalized to the same 5% grid used by reader preferences.

## Gesture handling

The first touch remains available to the reader's existing tap/swipe behavior. When a second touch establishes a valid pinch distance, the gesture bridge switches to pinch mode and suppresses the reader's single-pointer swipe/pan handlers for the rest of that gesture.

During the pinch, the page container receives a temporary transform preview based on the change in finger distance and midpoint. The preview does not directly mutate persisted reader state.

When the gesture ends, the temporary transform is removed and the final zoom is committed through the reader's existing Reset/Zoom/Ctrl+wheel controls. This keeps the reader's internal zoom value, the toolbar percentage, and the per-user preference bridge synchronized rather than maintaining a second independent zoom state.

Both final pointer-up events are suppressed after a pinch so the original first touch cannot accidentally become a page-turn swipe.

## Current limitation

The committed zoom recenters using the reader's normal transform. The midpoint translation is a live gesture preview rather than a separately persisted pan offset. After zooming above 100%, the existing one-finger drag-to-pan behavior remains available.
