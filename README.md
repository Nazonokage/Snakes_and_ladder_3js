# 3D Snakes & Ladders

A React, TypeScript, Three.js and Zustand board game with local hotseat play and a Firebase-backed online demo.

**Current release: v1.3 (1.3.0).** See [CHANGELOG.md](CHANGELOG.md). Local gameplay is ready. Firebase Authentication providers are enabled and the live database-read and guest-sign-in checks pass; full two-player acceptance testing remains pending.

## Run locally

Use Node.js 22 or newer and npm:

```sh
npm ci
npm run dev
```

Open the URL printed by Vite. Verification and production preview:

```sh
npm test
npm run build
npm run preview
```

## Set up and play

- Hotseat is the default. Choose a 6×6–12×12 board and name 2–4 players.
- Each new game gives players distinct random positions within the first row. Starting squares do not trigger effects until a player lands on them during a turn.
- Drag the setup panel, or focus its handle and use arrow keys. Minimize it with **−** to inspect the board.
- Drag the board to rotate; scroll or pinch to zoom. Touch controls are provided by OrbitControls.
- Choose **Start game**, then **Roll** or click/tap the dice preview. Keyboard users can focus the dice and press Enter or Space. You need an exact roll to finish.
- **Skip animation** immediately resolves the current turn, including connections, penalties, bonuses, and any reshuffle. It does not skip the player's turn.
- Bonus tiles give another roll; skip and freeze tiles delay future turns; backwards tiles move the pawn back. The upper board reshuffles once near the finish.
- Fresh bonus maps contain three bonus squares distributed across the board and three distinct penalty squares. **New bonus map** regenerates specials and connections; **Regenerate snakes & ladders** preserves your specials.

To add buffs or penalties, choose an **Effect**, enter **Number to add**, then select **Add squares**. This places the exact quantity on free tiles and keeps existing effects and connections. **Specific tile → Set tile effect** edits one numbered square instead. Capacity errors explain when the board cannot fit the requested quantity. Undo/redo applies to both actions.

## Motion, sound and dice

- A fixed right-side dice viewport looks directly at the rolled face, independent of board rotation. The last result stays visible after a turn.
- **Motion: Full / Gentle / Off** cycles through normal animation, softer animation, and instant local turn resolution with static decorative effects. Off also suppresses snake memes and confetti animation. The system's reduced-motion preference defaults to Off when no saved preference exists.
- In an online room, Motion Off changes your rendering; shared turn timing is controlled by the host. The active player can use Skip to finish the shared turn instantly.
- **Snake memes: On / Off** controls a short original ghost/snake reaction overlay. No external meme videos or downloads are required.
- **Sound: On / Off** controls synthesized dice, pawn, ladder, snake and win cues. Sound unlocks after a roll or sound-control interaction. Speaker-level balance still needs a listening check.
- Preferences are saved locally when browser storage is available.

## Online setup

The supplied `apiinfo.md` configuration has been copied into ignored `.env.local` in this checkout. On another machine, copy `.env.example` to `.env.local` and fill in your Firebase web app values. Vite exposes `VITE_` values to the browser; never put service-account keys or admin credentials there. Restart Vite after changing these values.

The optional Storage, messaging and measurement identifiers are accepted as configuration. Storage, messaging and Google Analytics are not activated by the game.

In the [Firebase console](https://console.firebase.google.com/project/snakes-ladders-game-dcab4/overview):

1. **Completed for this project:** Authentication is initialized and **Anonymous** and **Email/Password** providers are enabled. On another project, enable both under **Authentication → Sign-in method**.
2. **Verified:** `localhost` and the project's default Firebase domains are authorized. Check any new deployed host before adding redirect-based sign-in.
3. Open **Realtime Database → Rules**. `database.rules.json` and `database.rules.demo.json` contain the time-limited public read/write rules supplied in `apiinfo.md`. The Firebase CLI configuration targets `snakes-ladders-game-dcab4` and uses `database.rules.json`. Rules expire at **2026-10-30 00:00 Asia/Manila** (2026-10-29 16:00 UTC). These local files have not been deployed by this update. They let anyone read and change rooms, chat and rankings; use them only for a disposable demo. Accounts do not make these public rules private or protect scores from cheating.
4. Run `npm run check:firebase`. It checks reads at `gameState` and `leaderboard`, attempts anonymous sign-in, and deletes its temporary test account if sign-in succeeds. The active game itself is stored under `rooms`, not `gameState`.

**Live check on 2026-09-30, after console setup:** project `snakes-ladders-game-dcab4` returned HTTP 200 for both database reads. Anonymous sign-in succeeds and its temporary test account was removed. The console confirms Email/Password and Anonymous are enabled; `localhost` is authorized. Email-account registration, database writes and full two-player gameplay have not yet been verified. No remote database rules were changed.

Implementation references: [Firebase read/write and transactions](https://firebase.google.com/docs/database/web/read-and-write), [connection presence and disconnect cleanup](https://firebase.google.com/docs/database/web/offline-capabilities), and [anonymous authentication](https://firebase.google.com/docs/auth/web/anonymous-auth).

## Play online

1. Open **Online mode** from setup or gameplay. Enter a username and connect as a guest, or supply email/password to sign in. Select **Create account / upgrade guest** to register or preserve a guest's identity when upgrading it.
2. Choose **Host public room**, or search live players by username and select **Request to join** beside an available host. The host must accept a request before the match starts.
3. **Create unlisted room** hides it from matchmaking. Share its code to receive join requests for host approval. With public demo rules this is an unlisted room, **not an access-controlled private room**.
4. The host's current board draft and tile-1 starting positions are shared with both players. Customize/import a board before creating the room; editing is disabled during an online match.
5. Close the lobby to play. Only the active player can Roll or Skip. Use the collapsible bottom-left chat to send room messages; the latest 50 are displayed.
6. A win shows `@username` and celebration effects, then records one leaderboard win per room. Rankings count wins, with username ordering for ties.
7. Leave the room after a game to find another opponent. Explicitly leaving closes the room. Temporary connection loss keeps the room open: Firebase automatically reconnects and new actions wait for both players to return. An in-progress animation can finish while disconnected. The online panel includes Retry connection. Page reload recovery, abandoned-room cleanup, and host migration remain pending. Both players should keep the host's tab active because the host runs the animations and turn engine.

The database uses `presence`, `rooms`, `messages/{roomId}`, and `leaderboard/{roomId}`. Anonymous accounts persist in the current browser; clearing browser data or signing out can lose access to that guest identity. Email accounts can sign in again on another device. Firebase Authentication stores the display-name profile. Password reset, avatars, verified unique usernames and production moderation are not implemented.

## Board editor and drafts

Open **Customize** to edit a draft; **Apply & restart** starts a new game using it. Closing the editor preserves the current game. Startup changes preview immediately.

The editor supports undo/redo, colours, special cells, regeneration and validated `snl.board` JSON import/export. Drafts are saved locally. Existing saved drafts retain their special layout until you choose **New bonus map**. Online hosts share the selected draft; there is no collaborative editing or cloud board gallery.

## Deployment

Build with `npm run build`. On Vercel, select the Vite preset (build: `npm run build`, output: `dist`), set the same `VITE_FIREBASE_*` variables, and add the deployment domain to Firebase Authentication. A two-device online acceptance test and deployment remain pending.

## Development and verification

- `src/store/useGameStore.ts`: turn rules, random starts, queued movement and restart-safe skipping.
- `src/store/useOnlineStore.ts`: accounts, presence, matchmaking, shared turns, chat and win records.
- `src/lib/firebase.ts`: environment-based Firebase initialization.
- `src/utils/onlineProtocol.ts`: incoming shared-state validation.
- `src/components/Scene/GameScene.tsx`: procedural board, creatures, pawns, dice and effects.
- `src/components/UI/CustomizerModal.tsx`: floating setup and board editor.

Open `/?motion-demo` in development for repeatable animation checks; `?perf` displays rendering statistics. The test suite covers board validation, movement, audio timing, skipped turns, restart cancellation, exact-roll wins, spectator guards and malformed online snapshots. Browser verification covered local roll/skip and turn handoff. Live two-player, email-account, chat, ranking and mobile-device acceptance tests remain pending. Vite still reports a large application bundle warning.
