# Roadmap

The roadmap is ordered to keep the media library safe while progressively replacing the missing
parts of Jellyfin's standard book experience.

## Phase 0 - Foundation

- [x] Jellyfin 12 / .NET 10 project skeleton
- [x] Core/plugin separation
- [x] CI build and unit-test workflow
- [x] End-user README and developer documentation
- [x] Initial Komga-style `_oneshots` resolver
- [x] Plugin configuration page

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
- [ ] Cache and prefetch policy
- [x] Archive traversal and decompression-bomb protections
- [ ] Reader API integration tests against a running Jellyfin 12 server

## Phase 3 - Advanced paged reader

- [ ] Single-page mode
- [ ] Double-page mode
- [ ] LTR / RTL
- [ ] Fit width / height / screen / original
- [ ] Zoom and pan
- [ ] Click/tap, keyboard, wheel and swipe navigation
- [ ] Thumbnail/page navigator
- [ ] Fullscreen

## Phase 4 - Continuous reader and progress

- [ ] Vertical continuous mode
- [ ] Webtoon mode
- [ ] Lazy loading
- [ ] Configurable page prefetch
- [ ] Resume last position
- [ ] Mark completed at end
- [ ] Per-user reader preferences

## Phase 5 - Formats and clients

- [ ] CBR support
- [ ] PDF reader integration
- [ ] EPUB reader improvements
- [ ] Mobile/touch tuning
- [ ] Jellyfin wrapper-client compatibility matrix

## Phase 6 - Distribution

- [ ] Reproducible plugin package
- [ ] Repository manifest
- [ ] Release workflow
- [ ] Upgrade/migration tests
- [ ] Stable installation documentation
