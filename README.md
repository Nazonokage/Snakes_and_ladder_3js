# 3D Snakes & Ladders (React + R3F + Zustand)
`npm i && npm run dev` · `npm test` · `npm run build`

## How the four skills shaped this build
- **hybrid-game-assets** — all assets are procedural Three.js geometry (board, snake tube+canvas skin, ladder, lathe pawn, rounded dice). Provenance: procedural, no imports, no licences. 
- **game-map-editor** — `snl.board` v1 versioned document, strict validation (size, ranges, unique cells, direction, colours, 100 KB cap), bounded undo/redo, one history entry per edit, persistent *Draft only* tag, invalid local draft ignored with notice. Export is a proposal; play uses it only after *Apply & restart*.
- **enemy-systems** (adapted: no combat) — snakes, ladders and specials are authored data; one shared runtime state machine (`useGameStore`) resolves them by ID-free stage order `conn → special → shuffle → end`.
- **game-vfx** — a single pooled InstancedMesh (64 cap, no per-frame allocation), gameplay-coloured bursts, idempotent cleanup on restart, and `prefers-reduced-motion` support (no particles, instant dice/moves, toast still conveys meaning).
