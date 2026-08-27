# Nightfall

A real-time social deduction game (One Night Werewolf-style) built as a prototype:
React + TypeScript frontend, Node.js + Fastify + Socket.io backend, all game state
held **in-memory** on the server (no Redis/PostgreSQL/auth — see "Scope" below).

## Running it

```bash
npm install         # from the nightfall/ root — installs all 3 workspaces
npm run dev          # runs server (port 3001) and client (port 5173) together
```

Then open http://localhost:5173 in **multiple browser tabs/windows** (one per
player — you need 5 to 10 to start a game) and play through create/join → night
→ day → voting → reveal.

Run them separately if you prefer: `npm run dev:server` / `npm run dev:client`.

## Project layout

```
shared/   role definitions, deck-building, and the full Socket.io event contract
          (types shared verbatim between client and server)
server/   Fastify + Socket.io backend — the authoritative game state machine
          lives in server/src/gameEngine.ts, in-memory room store in roomStore.ts
client/   React + TS + Vite frontend, one screen per game phase (src/screens/)
```

## Scope, and deviations from the original spec

This was built as a **prototype-first** pass, per explicit choice at kickoff:

- **No Redis / PostgreSQL / Prisma.** Room and game state live in a `Map` in
  the server process. Everything resets if the server restarts. No user
  accounts, XP, coins, or cosmetics are persisted — the post-game JSON audit
  log (`initial_array`, `action_log`, `final_array`, `winning_faction`,
  `mvp_stats`) is generated and sent to clients, not written to a database.
- **No WebRTC voice chat.** Day/Voting phase mute/unmute is not implemented at
  all (explicitly out of scope). A lightweight text chat during the Day phase
  stands in for discussion instead.
- **No auth.** Players just pick a display name each session; there's no
  persistent identity across games.
- **Player count is 3–10.** The host configures the role deck per game from
  the lobby (Werewolf count, optional Insomniac/Hunter, Villager count) —
  Seer, Robber, Troublemaker, and Tanner are always exactly 1 each. The
  server enforces `MIN_PLAYERS = 3`, at least 1 Werewolf (2 at 5+ players,
  capped at half the table), and that the chosen counts add up to exactly
  `N + 3` cards before a game can start.
- **Room codes are `WORD-DDDD`** (e.g. `WOLF-4821`), matching the example in
  the spec literally, even though the spec's prose says "4-character."
- **Turn-timing obfuscation is simplified.** The server does emit
  `SPAWN_COIN`-equivalent (`coin:spawn`) events to inactive sockets during an
  active night step, and clients can tap a coin to send real `coin:tap`
  traffic back — but it's a single ping per step rather than a continuously
  randomized traffic pattern.
- **Win-condition edge case:** if zero Werewolves are dealt to any player (both
  in the center) and someone is still eliminated, the spec only defines the
  Village-loses side of that case, not an explicit Werewolf-wins rule for it.
  This implementation leaves that as "no faction wins" rather than inventing a
  rule the spec didn't state.
- **Actor identity for night actions is resolved from each seat's *original*
  dealt role**, not whatever card is currently at that seat — matching how
  the real game works (a player acts as the role they were shown at the start
  of the night, even if Robber/Troublemaker later moves that card elsewhere).
  Card *values* are still read/written on the live, mutating array.

## Verified

Both packages type-check cleanly (`tsc --noEmit` / `tsc -b`). The full game
loop — lobby → sequential night roles (including skipped center-only roles) →
day → voting → win evaluation → per-player results/action log — was verified
end-to-end with an automated 5-client Socket.io simulation. The UI itself
hasn't been visually tested in a browser (no browser automation available in
this session) — worth clicking through yourself before trusting it fully.
