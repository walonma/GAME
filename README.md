# 台灣麻將連線（Taiwan Mahjong Online）

A real-time 4-player Taiwan (16-tile) Mahjong game for playing with three friends over
the network. One person hosts a room, shares a 4-character room code, and everyone joins
from a browser (desktop or mobile) to play together live.

- **Server**: Node.js + TypeScript + Express + Socket.IO — authoritative game engine, one
  in-memory room per table.
- **Client**: React + TypeScript + Vite — mobile-friendly board UI. Tiles are rendered as
  plain CJK text/digits (not the Unicode "Mahjong Tiles" block), since that block isn't
  reliably supported by Android's system/emoji fonts.
- **Shared**: a `@mahjong/shared` package with the tile model and the client/server protocol
  types, so both sides stay in sync.

## Quick start (playing on one LAN / one machine)

```bash
npm install
npm run dev
```

This builds `@mahjong/shared` once and then runs the server (port 4000) and the client dev
server (port 5173) together. Open http://localhost:5173 in four browser tabs/devices to
try it out.

To play with friends who are **not** on your LAN, either:

1. **Deploy it** (see below) and share the public URL, or
2. Use a tunnel (e.g. `ngrok http 5173` for the client, and point `VITE_SERVER_URL` at a
   tunneled copy of port 4000) for a quick one-off game night.

### Running client and server separately

```bash
npm run build:shared      # compile the shared package once (rerun after changing packages/shared)
npm run dev:server        # http://localhost:4000
npm run dev:client        # http://localhost:5173, proxies to VITE_SERVER_URL (default http://localhost:4000)
```

### Tests

```bash
npm test
```

Runs the engine's unit tests (win detection, scoring/tai calculation, and full turn-flow
integration tests for discard/chi/pon/kong/hu/draw-game/dealer-rotation).

## Deploying for real (recommended for a standing game night room)

The server also serves the built client, so the whole game is one deployable process with
one URL — no separate frontend hosting needed.

### One-click deploy (Render, free tier)

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/walonma/GAME)

This repo includes a `render.yaml` blueprint. Clicking the button walks you through: sign in
to Render with GitHub (free, no credit card needed for this service type) → confirm the
blueprint → Render builds and starts the app automatically. You'll get a URL like
`https://taiwan-mahjong.onrender.com` — that's the link everyone opens to play. See
"How to connect and play" below for the exact steps once it's live.

Render's free web services spin down after ~15 minutes of no traffic and take 30-60s to
wake back up on the next request — normal for a casual game, just means the first person to
open the link before game night should expect a short wait (a page refresh after ~30s fixes
a first-load socket hiccup while it's waking up).

### Manual / self-hosted

```bash
npm run build
node packages/server/dist/index.js
```

Set `PORT` (default `4000`) and optionally `CLIENT_ORIGIN` (CORS allow-list; omit to allow
any origin, fine for a small private game). Deploy that one process anywhere that runs
Node (Railway, Fly.io, a small VPS, ...), then everyone opens the same URL and uses
"建立新房間" / "加入房間" to create or join a table.

There is no database — rooms live in server memory and are cleared when everyone
disconnects, so a server restart resets any in-progress games. A player who refreshes or
briefly loses connection is automatically reconnected to their seat via a token stored in
`localStorage`.

## How to play

1. One player opens the site, enters a name, and clicks **建立新房間** to get a 4-letter
   room code.
2. The other three open the site, enter their names, and **加入房間** with that code.
3. Once all 4 seats show **已準備**, the host clicks **開始遊戲**.
4. Play proceeds automatically: draw → (discard or declare kong/hu) → other players get a
   short window to call 吃 (chi) / 碰 (pon) / 槓 (kong) / 胡 (hu) on your discard, with hu
   always taking priority. Your action buttons and legal moves are computed by the server,
   so you can only do what's actually legal.
5. When a hand ends (win or 流局 draw), a summary shows the tai breakdown and point
   transfer; any player can click **下一局** to deal the next hand.

## Rules implemented (and scope notes)

This is a full **16-tile Taiwan Mahjong** engine, not a simplified variant:

- 144-tile set (3 suits × 1-9 × 4, 4 winds × 4, 3 dragons × 4, 8 unique flowers), 16 tiles
  dealt per player, dealer draws the 17th to start.
- Automatic flower replacement (both at deal time and on every draw).
- Chi (only from the previous player in turn order), Pon, Kong (concealed 暗槓, exposed
  大明槓, and added 加槓 with a proper 搶槓 robbing window), and Hu, with server-side
  priority resolution (Hu beats Kong/Pon beats Chi) and support for multiple simultaneous
  winners off one discard (一炮多響).
- A hand must clear at least 1 tai to be declared (無台不能胡), matching common table rules.
- Tai (台) scoring covers the common/major patterns: 門清, 自摸, 平胡, 碰碰胡, 三暗刻/四暗刻/
  五暗刻, 混一色/清一色/字一色, 小三元/大三元, 小四喜/大四喜, 全求人, 槓上開花, 海底撈月,
  搶槓, 莊家, and 花牌 (1 tai per flower tile held).
- Dealer continues (連莊) on a draw or a dealer win; otherwise the seat rotates.

**Deliberately out of scope for this MVP** (the rule set is large; these are the corners
cut to keep the engine maintainable — see `packages/server/src/game/Scoring.ts` for exactly
what's scored):

- Less common/regional tai patterns (e.g. unique-wait bonuses, 全帶幺, seat/round-specific
  flower bonuses, 七對 as a special hand) are not scored.
- No multi-round (東/南/西/北 風) progression — every hand is played as East round; the
  session just keeps rotating the dealer and tallying score across as many hands as you
  like.
- No persistence/reconnaissance across server restarts, and no spectator mode.

## Project layout

```
packages/
  shared/   tile model + client<->server protocol types (used by both server and client)
  server/   Socket.IO server: room/session management + the Mahjong game engine
    src/game/MahjongGame.ts   turn state machine (deal/draw/discard/chi/pon/kong/hu)
    src/game/WinChecker.ts    hand-decomposition (is this 17-tile hand a valid win?)
    src/game/Scoring.ts       tai (台) calculation
    src/room/                 room codes, player tokens/reconnect, per-seat state broadcast
    src/test/                 vitest unit + integration tests
  client/   React board UI (Vite)
```
