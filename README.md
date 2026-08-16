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

This repo's `render.yaml` blueprint defines **two separate services from the same
codebase** — clicking the button deploys both at once, each getting its own URL:

- **`taiwan-mahjong-4p`** — strict 4-human-players version. No "fill with bots" option is
  even shown.
- **`taiwan-mahjong-2p`** — 2-4 players version. Empty seats can be filled with
  computer-controlled bots (see "Playing with fewer than 4 people" below).

Both are built from the exact same source; which mode a deployment is in is controlled by
an `ALLOW_BOTS` environment variable set per-service in `render.yaml` (baked into that
service's build, and also enforced server-side so it can't be bypassed from the browser) —
not by a different branch. So updates you push land in both automatically.

Sign in to Render with GitHub (free, no credit card needed for this service type), confirm
the blueprint, and Render builds + starts both apps. The exact URLs Render assigns may have
a random suffix if the plain name is taken (e.g. `taiwan-mahjong-4p-xxxx.onrender.com`) —
whatever it shows you after deploying is the link to share. Each app's home screen shows a
small badge ("四人連線版" / "2～4 人版") so it's obvious which one a link is.

Render's free web services spin down after ~15 minutes of no traffic and take 30-60s to
wake back up on the next request — normal for a casual game, just means the first person to
open a link before game night should expect a short wait (a page refresh after ~30s fixes a
first-load socket hiccup while it's waking up).

If you only want one of the two (not both), just delete the other service afterward from
the Render dashboard — they're independent once created.

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

### Playing with fewer than 4 people (computer-controlled seats)

You don't need 4 humans. In the lobby, anyone can click **找電腦補位** to fill every empty
seat with a computer player (e.g. 2 friends + 2 computer seats, or solo against 3). Bot
seats show a **電腦** badge, are always "ready," and play on their own once the game starts:
they take a short pause (under ~2s) then draw/discard, and independently decide whether to
call 吃/碰/槓/胡 during the response window like a real player would. A human still has to
click **下一局** between hands.

The bot is a simple heuristic player, not a full solver — it always takes a win or an
available kong, calls pon/chi opportunistically rather than always, and otherwise discards
whatever in its hand looks least useful to keep (isolated honor tiles first, then isolated
number tiles, keeping pairs/triplets and tiles with run potential). It's meant to keep a
short-handed game moving and be a reasonable opponent, not to play optimally.

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
