# Roadmap

The roadmap is ordered to keep the media library safe while progressively replacing the missing parts of Jellyfin's standard book experience.

## Phase 0 - Foundation

- [x] Jellyfin 12 / .NET 10 project skeleton
- [x] Core/plugin separation
- [x] CI build and unit-test workflow
- [x] End-user README and developer documentation
- [x] Initial Komga-style `_oneshots` resolver
- [x] Plugin configuration page
- [x] English/Japanese/German/French/Spanish/Simplified Chinese configuration localization

## Phase 1 - Komga library compatibility

- [ ] Integration-test One-Shots against a real Jellyfin 12 scanner
- [ ] Ensure single-file and multi-file One-Shots directories behave consistently
- [ ] Preserve/merge ComicInfo metadata without re-grouping One-Shots
- [ ] Add explicit One-Shot identification usable by the future reader UI
- [ ] Add diagnostics for why a path matched or did not match
- [ ] Test large libraries and scanner performance

## Phase 2 - Page API

- [x] CBZ/ZIP entry enumeration
- [x] Natural page ordering
- [x] Page metadata endpoint
- [x] Individual page streaming endpoint
- [x] Bounded reader-side prefetch/cache policy
- [x] Archive traversal and decompression-bomb protections
- [x] Bounded thumbnail endpoint using Jellyfin image processing
- [ ] Live Jellyfin reader API integration tests

## Phase 3 - Advanced paged reader

- [x] Jellyfin Web reader injection adapter
- [x] Single-page mode
- [x] Double-page mode
- [x] Smart spreads: first/last and landscape pages remain single
- [x] Resolve page orientation before committing a Double Page spread
- [x] LTR / RTL
- [x] Fit width / height / screen / original
- [x] Basic zoom and drag-to-pan
- [x] Click/tap, keyboard, wheel and swipe navigation
- [x] Thumbnail/page navigator
- [x] Lazy thumbnail loading and bounded Blob cache
- [x] Direct page jumping
- [x] Full-window reader overlay
- [x] Persist reader preferences per user
- [x] Restore layout/direction/fit/zoom after resume
- [x] Dedicated two-finger pinch-to-zoom across all reader modes
- [x] Responsive auto-hiding reader chrome
- [x] Direct page scrubber across all reader modes
- [x] Responsive desktop settings panel / mobile bottom sheet
- [x] Continuous/Webtoon side padding and page-gap preferences
- [x] Reader fullscreen toggle where browser APIs are available
- [x] Intent-aware desktop chrome reveal / hover pinning
- [x] Debounced thumbnail preview while page scrubbing
- [x] Pointer-anchored low-latency scrub preview
- [x] Measured viewport Fit sizing and square mobile reader controls
- [x] Jellyfin title/author/series/year metadata in reader chrome
- [x] Per-field metadata visibility and overflow auto-scroll preferences
- [x] Black/gray/white reader backgrounds
- [x] Optional page-transition animation and touch gestures
- [x] Contextual keyboard/gesture help
- [x] Six-language Advanced Reader localization with automatic locale detection
- [x] Per-user language override while retaining automatic Jellyfin/browser detection
- [x] Grouped Reader Settings and compact floating mobile chrome
- [x] One-direction metadata marquee with invisible reset instead of ping-pong motion
- [x] Mobile overflow menu for secondary Fullscreen/Help actions
- [x] Collapsible Reader Settings with mobile accordion behavior
- [x] SVG previous/next controls with corrected visual centering
- [x] Browser/mobile Back closes Advanced Reader through a dedicated history entry
- [x] Optional replacement of Jellyfin Book Resume/Start-over actions

## Phase 4 - Continuous reader and progress

- [x] Vertical continuous mode
- [x] Webtoon mode
- [x] IntersectionObserver-based lazy loading
- [x] Bounded continuous-mode prefetch/cache
- [x] Direction-aware continuous read-ahead
- [x] Continuous slot-height stabilization and scroll-anchor compensation
- [x] Viewport-aware current-page tracking
- [x] Resume last position
- [x] Mark completed at end
- [x] Jellyfin reading-position synchronization
- [x] Preserve existing played state during rereads
- [ ] Live cross-client resume/preferences test against Jellyfin 12

## Phase 5 - Formats and clients

- [ ] CBR support
- [ ] PDF reader integration
- [ ] EPUB reader improvements
- [x] Continuous/Webtoon zoom and desktop drag panning
- [x] Pinch isolation from page pan/scroll
- [x] Viewport-priority page-grid thumbnail scheduling
- [x] Page-grid watchdog/retry and bounded full-page fallback
- [x] Mixed-size viewport-marker current-page tracking
- [x] One-image-per-slot Continuous/Webtoon render invariant with stale-load generation guards
- [x] Ignore `__MACOSX` / AppleDouble image-like archive metadata entries
- [x] Contained scrub-preview loading/error overlay
- [ ] Further live-device mobile/touch interaction tuning
- [ ] Jellyfin wrapper-client compatibility matrix

## Phase 6 - Distribution

- [x] Development plugin artifact in CI
- [x] Reproducible release plugin package
- [x] Repository manifest
- [x] Repository-owned Catalog icon/banner and `imageUrl` metadata
- [x] Books-category Catalog metadata
- [x] Repository-first installation and update documentation
- [x] Release workflow
- [x] Localization/catalog validation in CI and Release
- [x] CI cost controls (ready PR/manual CI, no duplicate main build)
- [ ] Upgrade/migration tests
- [ ] Official Jellyfin repository submission/review
