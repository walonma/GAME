import { ClientAction, LegalAction, Tile } from "@mahjong/shared";
import { MahjongGame } from "./MahjongGame";

// A simple heuristic bot, not a full solver: always takes a win or a kong when available,
// calls pon/chi opportunistically (not every time, so it doesn't recklessly expose its hand),
// and otherwise discards the tile that looks least useful to keep. Good enough for a casual
// game against friends, not meant to play optimally.

const PON_CALL_CHANCE = 0.6;
const CHI_CALL_CHANCE = 0.5;

function tileKey(t: Tile): string {
  return `${t.suit}${t.value}`;
}

/** Higher score = more worth keeping. Ties are broken by picking the first lowest-scoring tile. */
function scoreTileToKeep(tile: Tile, counts: Map<string, number>): number {
  const count = counts.get(tileKey(tile))!;
  if (count >= 2) return 10; // already paired/tripled up - keep

  if (tile.suit !== "man" && tile.suit !== "pin" && tile.suit !== "sou") {
    return -1; // a lone honor/dragon tile is the least flexible thing to hold
  }

  // Numbered tile with only one copy: score by how much run-potential its neighbors give it.
  let neighborScore = 0;
  for (let d = 1; d <= 2; d++) {
    if (counts.has(`${tile.suit}${tile.value - d}`)) neighborScore += 3 - d;
    if (counts.has(`${tile.suit}${tile.value + d}`)) neighborScore += 3 - d;
  }
  return neighborScore; // 0 = fully isolated numbered tile
}

function pickDiscardTile(hand: Tile[]): Tile {
  const counts = new Map<string, number>();
  for (const t of hand) counts.set(tileKey(t), (counts.get(tileKey(t)) ?? 0) + 1);

  let worst = hand[0];
  let worstScore = Infinity;
  for (const t of hand) {
    const s = scoreTileToKeep(t, counts);
    if (s < worstScore) {
      worstScore = s;
      worst = t;
    }
  }
  return worst;
}

function find<T extends LegalAction["type"]>(actions: LegalAction[], type: T): Extract<LegalAction, { type: T }> | undefined {
  return actions.find((a) => a.type === type) as Extract<LegalAction, { type: T }> | undefined;
}

export function chooseBotAction(game: MahjongGame, seat: number): ClientAction {
  const actions = game.getLegalActionsFor(seat);

  if (find(actions, "hu")) return { type: "hu" };

  const kong = find(actions, "kong");
  if (kong) return { type: "kong", tileIds: kong.groups[0] };

  const pon = find(actions, "pon");
  if (pon && Math.random() < PON_CALL_CHANCE) return { type: "pon", tileIds: pon.groups[0] };

  const chi = find(actions, "chi");
  if (chi && Math.random() < CHI_CALL_CHANCE) {
    const group = chi.groups[Math.floor(Math.random() * chi.groups.length)];
    return { type: "chi", tileIds: group };
  }

  if (find(actions, "discard")) {
    const tile = pickDiscardTile(game.players[seat].hand);
    return { type: "discard", tileId: tile.id };
  }

  return { type: "pass" };
}
