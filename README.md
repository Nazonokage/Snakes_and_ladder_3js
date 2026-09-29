# 3D Snakes & Ladders

A local multiplayer board game built with React, TypeScript, Three.js, React Three Fiber, and Zustand.

**Current release: v1.2** (package version 1.2.0). See [CHANGELOG.md](CHANGELOG.md) for release notes.

## Run locally

Install Node.js 18 or newer and npm, then run:

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. To check or preview a production build:

```sh
npm test
npm run build
npm run preview
```

## Set up and play

- Choose a board size from 6×6 to 12×12, set colours and snake/ladder density, and name 2–4 players.
- Startup settings preview changes live. Drag the floating panel by its title bar, or use its focused handle and arrow keys (Shift moves farther).
- Minimize settings with **−** and expand with **+**. **Regenerate** and **Start game** remain available while minimized.
- Drag the exposed board to rotate it; scroll or pinch to zoom.
- Select **Start game**, then use the roll button for the current player. An exact roll is required to reach the final tile.
- Special tiles can award a bonus roll, skip a turn, freeze a player, or send a piece backwards. The upper board reshuffles once when a player nears the finish.

## Animation and sound

- Snakes wriggle, flick forked tongues, and have tapered tails. A snake encounter opens its mouth, swallows the pawn, carries a visible bulge down its body, and releases the pawn at its tail.
- Pawns move one tile per second. Ladder climbs move continuously with eased starts and stops, taking approximately 2–5 seconds depending on length.
- Dice toss, tumble, bounce, and settle. A dedicated dice view keeps the roll visible at different board angles.
- **Motion: Full / Gentle** adjusts movement intensity. Gentle mode keeps essential travel visible and defaults on when the system requests reduced motion.
- **Sound: On / Off** controls synthesized effects for dice, pawn takeoff and landing, ladder steps, snake encounters, and winning. Audio activates after a roll or sound-control interaction, as required by browsers.
- Motion and sound choices are saved locally when browser storage is available. Sound effects do not require downloaded audio files.

## Board editor and saved drafts

Open **Customize** during a game to edit a draft. **Apply & restart** applies it to a new game; closing the editor keeps the current game unchanged. Startup setup previews the draft immediately.

The editor supports undo/redo, colour choices, special tiles, regeneration, and JSON import/export. Drafts are saved in browser storage; active games are not saved across reloads. Imports use the versioned `snl.board` format and validate board dimensions, connections, colours, and special cells. Invalid saved drafts fall back to the default board.

## Development

- `src/components/Scene/GameScene.tsx`: procedural board, snakes, ladders, pawns, dice, and effects.
- `src/utils/motion.ts`: movement timing, travel paths, tail taper, and pawn sound timing.
- `src/utils/feedback.ts`: synthesized sound cues and sound preferences.
- `src/store/useGameStore.ts`: turns, movement queues, special tiles, and winning.
- `src/components/UI/CustomizerModal.tsx`: floating startup settings and draft editor.

With the development server running, open `/?motion-demo` for repeatable tile, snake, ladder, and dice checks. This panel is disabled in production builds. Add `?perf` to view scene rendering statistics.

The test suite covers board generation/validation, document round trips, movement endpoints and timing, continuous ladder progress, snake swallowing, tapered tails, and synchronized pawn sound events. All visual assets are generated procedurally; no external models or textures are required.
