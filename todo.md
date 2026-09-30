# Snakes & Ladders 3D — TODO

**Last updated:** 2026-09-30  
**Status:** Local features implemented and tested; online code implemented, database reads and guest authentication verified; both sign-in providers enabled; full online acceptance testing pending.  
**Backend:** Firebase Realtime Database, configured from `apiinfo.md` through ignored `.env.local`.  
**Repo:** https://github.com/Nazonokage/Snakes_and_ladder_3js

Checked items below mean implemented in code. See the verification section for what was tested live.

## 1. Local hotseat

- [x] Dedicated right-side dice viewport facing the rolled result; click, tap or keyboard activation rolls with turn guards.
- [x] Explicit buff quantity control places the requested number on free tiles; specific-tile editor clearly labelled.
- [x] Big red Skip animation button with instant turn resolution and sound.
- [x] Original ghost/snake meme reaction overlay with an on/off control (procedural; no external GIF/video).
- [x] Random buff placement with exact quantity and strength; randomize positions preserves configured effects.
- [x] All players start on tile 1.
- [x] Hotseat remains the default.

## 2. Online mode

- [x] Online mode entry in settings and gameplay.
- [x] Live player presence and username search.
- [x] Public/unlisted two-player rooms; choose a host by username or room code and request to join.
- [x] Real-time shared pawn/turn state using the host's game engine.
- [x] Room chat with the latest 50 messages displayed.
- [x] Active player's Skip control; snake reactions in both modes.
- [x] @username winner display and celebration effects.
- [x] Unlisted room codes and host-customized boards.
- [ ] Access-controlled private rooms (public demo rules cannot provide privacy).
- [ ] Page-reload recovery, abandoned-room cleanup, and host migration.

## 3. Firebase setup

- [x] Install Firebase SDK and add `src/lib/firebase.ts`.
- [x] Read `apiinfo.md` and populate ignored `.env.local`; add `.env.example`.
- [x] Implement `presence`, `rooms`, `messages`, and `leaderboard` paths.
- [x] Provide `database.rules.demo.json` with the requested public demo rules.
- [x] Add `npm run check:firebase` and test the supplied endpoint.
- [x] Initialize Firebase Authentication and enable Anonymous and Email/Password for `snakes-ladders-game-dcab4`. Console confirms both enabled.
- [x] Verify live anonymous sign-in succeeds; remove the temporary probe account.
- [x] Verify replacement project database reads: `gameState` and `leaderboard` return HTTP 200.
- [x] Align local Firebase project and valid JSON rule files with the new configuration.
- [ ] Verify database writes and deployed rules; supplied temporary rules expire October 30, 2026 at 00:00 Manila time.
- [x] Verify `localhost` and default Firebase domains are authorized.
- [ ] Verify the eventual deployment domain.

Rules were not deployed. The game stores its state inside each room, not a separate global `gameState` path. See README for setup and the limits of public demo rules.

## 4. Accounts and ranking

- [x] Anonymous guests, email/password registration and sign-in, guest upgrade, sign-out.
- [x] Firebase display-name profiles.
- [x] Wins saved by account identity, one result per room.
- [x] Live wins leaderboard and personal rank.
- [ ] Password recovery, email verification, avatars and unique usernames.
- [ ] Server-validated scoring and production access rules.

## 5. Polish and editor

- [x] Full / Gentle / Off motion preferences and persistent sound/meme controls.
- [x] Touch rotation and pinch zoom through OrbitControls; responsive controls.
- [x] Existing board editor, import/export, undo/redo and local drafts retained.
- [x] Host's custom board shared with online opponents.
- [x] Existing synthesized sound effects retained.
- [ ] Collaborative online board editing and a cloud board gallery.
- [ ] Optional external sound pack and an interactive first-run tutorial.

## 6. Verification and deployment

- [x] 38 automated tests pass, covering turns, setup, buff generation, online payloads, join approval, and connection guards.
- [x] Production build passes (large bundle warning remains).
- [x] Browser check: local roll, skip and turn handoff.
- [ ] Two-device online acceptance test after Firebase setup: matchmaking, turns, skip, chat, wins and disconnects.
- [ ] Real email-account and guest-upgrade test after Authentication setup.
- [ ] Real touch-device acceptance and speaker-level sound check.
- [ ] Deploy to Vercel and repeat online acceptance tests.
- [x] Update README and CHANGELOG with features, setup and honest verification status.

## 7. Latest fixes — September 30, 2026

- [x] Numeric player-count and board-size values fix the empty-player HUD crash; 2–4 player turn cycles are tested.
- [x] Buff quantity and strength controls, displayed values, and preservation when randomizing/resizing.
- [x] Username-based join requests with host Accept/Decline controls; room-code joins also require approval.
- [x] Temporary network drops retain the room; Firebase reconnects automatically and restores presence. New roll/skip actions require both members online. An in-progress animation may finish while disconnected.
- [x] Retry connection control in the online panel. Explicitly leaving still closes a member’s room; cancelling a join request does not close the host’s room.
- [x] Collapsible room chat at bottom left, with mobile positioning above the game controls.
- [x] Add an explicit favicon to address the missing icon request.
- [ ] Browser verification of recent setup, buff, matchmaking, chat layout, and reconnection changes.
- [ ] Two-device network-drop test for host and guest, including a drop during an animation and return after a win.

## 8. Console report triage

| Report | Status |
| --- | --- |
| HUD cannot read player name | Fixed invalid numeric selector values that emptied the player list. |
| Missing favicon | Added SVG favicon and page link. |
| contentscript.js listener warnings / ObjectMultiplex | Likely browser-extension output; reproduce with extensions disabled if it persists. |
| React DevTools download message | Informational development message. |
| WebGL context lost | Reported alongside the crash; verify whether it recurs after the fix. |

Checked items describe implemented behavior. Mocked automated tests do not replace live Firebase acceptance tests. Existing Firebase verification above records prior checks; no rules or deployment were changed in this update.
