# Pinch zoom behavior

Advanced Books uses one Reader-owned zoom state for **Single Page**, **Double Page**, **Vertical Continuous**, and **Webtoon**. Toolbar zoom, keyboard + / − / 0, Ctrl+wheel, double-tap, persisted preference restore, and two-finger pinch all update the same `reader.zoom`, `reader.panX`, and `reader.panY` state.

## Architecture

The responsibilities are deliberately separated:

- `advancedBooksReader.js` owns zoom, pan, fit mode, continuous sizing, touch-action, resize handling, and the public `setZoom(value, anchor, options)` operation.
- `advancedBooksZoom.js` contains only reusable geometry: focal-point normalization, rendered paged bounds, paged pan clamping, and continuous image/slot anchor capture and restoration.
- `advancedBooksGestures.js` interprets touch, double-tap, pointer, and wheel input. It calls the Reader API and **must not replace** `reader.setZoom` or `reader.applyTransform`.

The Zoom Geometry script is a required JavaScript Injector entry and an embedded resource verified from the built plugin DLL. Reader Core resolves it when zoom is actually used; correctness does not depend on the persisted JavaScript Injector list order during upgrades.

## Pinch lifecycle

A first touch remains available to normal reader tap/swipe behavior. When a second touch establishes a valid pinch, the gesture bridge cancels the Reader's single-pointer state and owns the participating pointer events until the gesture ends.

Each animation frame computes:

1. the current two-finger distance and target zoom;
2. the previously rendered pinch midpoint;
3. the new pinch midpoint.

Gestures then calls:

```js
reader.setZoom(targetZoom, currentMidpoint, {
    snap: false,
    fromAnchor: previousMidpoint
});
```

This means the content point that was under the previous midpoint moves to the new midpoint while the scale changes. There is no temporary CSS preview transform and no second, different transform to commit on pointer release.

On release the live value is normalized to the Reader's 5% preference grid. A completed multi-touch gesture suppresses its trailing pointer-up events so it cannot become an accidental page turn.

## Paged modes

Single and Double Page use the actual rendered image/spread bounds. The Reader clamps `panX` and `panY` both when zoom changes and while the user subsequently drags.

This prevents:

- zooming toward an unreachable corner;
- dragging the entire page into empty black space;
- a different pan range between Ctrl+wheel, double-tap, toolbar zoom, and pinch;
- stale pan coordinates after a viewport resize or device rotation.

When zoom returns to 100% or below, paged pan resets to the centered position.

## Vertical Continuous and Webtoon

Continuous layouts preserve the actual content point under the gesture:

- if the focal point is over a page image, that image is the anchor;
- if it is in surrounding whitespace, the page slot is the fallback;
- if no pointed slot is available, the currently tracked page is used.

After the Reader applies its real fit/zoom sizing, scrollLeft/scrollTop are adjusted so that the same normalized content point lands under the requested target focal point.

Fit Screen scales both the continuous canvas and its image-height cap. Fit Width, Fit Height, and Original Size use the same focal-point restoration path.

At 100% or below, normal one-finger continuous scrolling remains native. Above 100%, Advanced Books can use one-finger touch panning when **Touch gestures** is enabled. When that setting is disabled, the Reader immediately restores native two-axis browser panning with `touch-action: pan-x pan-y`.

## Validation

Source validation rejects the former layered implementation, including:

- `installAnchoredZoom`;
- assignments that replace `reader.setZoom` or `reader.applyTransform`;
- `livePagedPinch`;
- the temporary `previewRatio` pinch transform.

Validation also requires source-to-target midpoint tracking, actual-image continuous anchoring, rendered paged pan clamping, Core-owned touch-action handling, and the presence of the required Zoom Geometry registration.
