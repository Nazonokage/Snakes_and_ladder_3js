# Changelog

## [v1.3] — 2026-09-30

### Buff controls and dice interaction

- Added an explicit Number to add control that places exactly the requested number of effects on distinct free tiles, with clear capacity errors and no overwriting of existing squares or connections.
- Labelled the existing tile-number control as Specific tile and its action as Set tile effect.
- Made the dice preview a keyboard-accessible roll button using the same online-turn and animation guards as the main Roll button.
- All 24 automated tests pass and the production build succeeds.

### Firebase Authentication setup completed

- Initialized Authentication in the replacement project and enabled Anonymous and Email/Password through the Firebase console.
- Verified localhost is already an authorized domain.
- Live readiness check now passes: both database reads return HTTP 200, anonymous sign-in succeeds, and the temporary probe account is removed.
- No database rules were changed. Email-account registration and full two-player online acceptance testing remain pending.

### Firebase account update

- Switched local environment and configuration template to `snakes-ladders-game-dcab4` using the updated `apiinfo.md`.
- Removed the old hard-coded database fallback; online setup now requires an explicit database URL.
- Normalized local rule files to valid JSON and matched the supplied expiry: October 30, 2026 at 00:00 Manila time. No remote rules were deployed.
- Replacement-project database read checks pass (HTTP 200). The initial anonymous-auth check returned `auth/configuration-not-found`; this was resolved by the Authentication setup recorded above. Writes, email sign-in and end-to-end online play remain unverified.

### Added

- Red Skip animation control that resolves the entire turn, including delayed previews, connections, special cells and reshuffling, with sound feedback.
- Motion Off preference with instant local turns, static decorative effects, and suppressed reaction overlays; system reduced-motion preferences default to Off.
- Toggleable original ghost/snake meme overlay and win celebration.
- Distinct random first-row starting positions on new games.
- Fresh bonus maps with three distributed reward cells and three penalties; a New bonus map editor control.
- Firebase SDK and environment configuration using the supplied apiinfo.md values in ignored .env.local, with a shareable empty .env.example.
- Online lobby, anonymous and email/password accounts, guest account upgrading, display-name profiles, live player search, 1v1 matchmaking and unlisted room codes.
- Host-driven shared turns and custom boards, active-player roll/skip controls, room chat, per-room win records and personal ranking.
- Presence cleanup and room closure on disconnect; validation of incoming game snapshots and transaction-based room claiming.
- Demo database rules file and a Firebase readiness check script. Neither rules nor a deployment were published.
- Regression tests for skip effects, restart cancellation, exact-roll wins, random starts, spectator guards and incoming room payloads.

### Changed

- Dedicated dice viewport faces the result directly; the result remains visible after the turn and skipping settles the die.
- Mobile controls use a scrollable player panel and a smaller dice view to reduce overlap.
- Synchronous state changes are batched before online publication; turn commands include the roll number to reject stale actions.
- README and TODO now distinguish implemented code, verified behavior and remaining external setup.

### Validation and known limitations

- All 24 automated tests pass; production build succeeds with the existing large-bundle warning.
- Browser verification confirms local rolling, skip completion and handoff to the next player.
- Initial-project checks returned HTTP 401 for reads. After the Firebase account update, replacement-project reads pass; anonymous sign-in also passes following console setup. Full online acceptance testing remains pending.
- Two-device online play, email accounts, chat, ranking and touch-device acceptance testing remain unverified against a working backend.
- Rooms are demo-grade: public rules do not protect private data or scores; unlisted rooms are not access-controlled private rooms. Host migration, password reset, collaborative board editing and a cloud board gallery are not included.
- Vercel deployment remains pending.


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
