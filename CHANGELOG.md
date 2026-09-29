# Changelog

## [v1.2] — 2026-09-29

### Added

- Animated snake bodies, moving heads, flicking forked tongues, and tapered tail tips.
- Snake encounter choreography: opening jaws, swallowing a pawn, a travelling body bulge, and release at the tail.
- A dedicated dice view with visible toss, tumble, bounce, and settling animations.
- Synthesized sound feedback for rolls, dice impacts, pawn takeoff and landing, ladder climbs, snakes, and wins, plus a persistent sound toggle.
- Full and Gentle motion controls with locally saved preferences.
- Draggable, keyboard-movable startup settings with minimize/expand controls and live regeneration while minimized.
- A development-only animation demonstration panel and movement/audio-timing regression tests.

### Changed

- Pawns take one second per tile, with eased travel and softer hops. Backwards moves also follow individual tiles.
- Ladder travel is continuous rather than stopping at every rung; duration scales with length and is capped at 5.2 seconds.
- Snake encounters take 4.8 seconds, with eased travel through the body.
- Board framing adapts to the window, and camera controls use damping.
- Startup settings explain live previews and board controls; gameplay controls appear after starting the game.
- Package version updated to 1.2.0 for the v1.2 Git tag.

### Fixed

- Reduced-motion preferences no longer turn pawn travel into near-instant jumps or skip dice rolling.
- Connection movement blends into destination positions without snapping.
- Pawn landing sounds trigger at tile contact instead of after the landing pause; backwards steps have individual cues, without duplicate end-of-move taps.
- Floating settings remain inside the viewport after resizing or expanding.

### Validation

- Production build succeeds.
- All 12 automated tests pass.
- Browser checks cover snake animation, dice visibility, pawn and ladder travel, sound-toggle state, and floating setup controls. Speaker-level sound balance still needs a listening check on the target device.

## Initial version

- Procedural 3D board, local multiplayer turns, snakes and ladders, special tiles, and a late-game board reshuffle.
- Configurable boards, JSON import/export, persistent drafts, and undo/redo.

[v1.2]: https://github.com/Nazonokage/Snakes_and_ladder_3js/releases/tag/v1.2
