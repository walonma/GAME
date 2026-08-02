import { Tile, Meld } from "@mahjong/shared";
import { decomposeWinningHand } from "./WinChecker";

export interface ScoringInput {
  seat: number;
  dealerSeat: number;
  concealedTiles: Tile[]; // hand including the winning tile
  melds: Meld[];
  winningTile: Tile;
  selfDrawn: boolean;
  flowers: Tile[];
  wonOnKongReplacement: boolean; // 槓上開花
  wonOnLastTile: boolean; // 海底撈月 / 河底撈魚
  wonByRobbingKong: boolean; // 搶槓
}

export interface TaiEntry {
  name: string;
  tai: number;
}

const POINTS_PER_TAI = 100;
/** House rule: a hand needs at least this many tai (excluding flowers) to be declared. */
export const MIN_TAI_TO_WIN = 1;

function isConcealedMeld(m: Meld): boolean {
  return m.type === "kong-concealed";
}

function isOpenMeld(m: Meld): boolean {
  return m.type === "chi" || m.type === "pon" || m.type === "kong-exposed" || m.type === "kong-added";
}

/**
 * Computes the tai (台) breakdown for a winning hand. Implements the common/major patterns
 * of Taiwan (16-tile) mahjong scoring; obscure/regional patterns are intentionally out of
 * scope for this MVP (see README).
 */
export function computeTai(input: ScoringInput): TaiEntry[] {
  const { melds, concealedTiles, seat, dealerSeat, selfDrawn, flowers } = input;
  const decomposed = decomposeWinningHand(concealedTiles, melds);
  const entries: TaiEntry[] = [];
  if (!decomposed) return entries; // not actually a winning hand

  const allSets = [
    ...decomposed.sets.map((s) => ({ suit: s.suit, value: s.value, type: s.type as "triplet" | "sequence" })),
    ...melds.map((m) => ({
      suit: m.tiles[0].suit,
      value: m.tiles[0].value,
      type: (m.type === "chi" ? "sequence" : "triplet") as "triplet" | "sequence",
    })),
  ];
  const concealedTripletCount =
    decomposed.sets.filter((s) => s.type === "triplet").length +
    melds.filter((m) => m.type === "kong-concealed").length;
  const totalTripletCount = allSets.filter((s) => s.type === "triplet").length;
  const totalSequenceCount = allSets.filter((s) => s.type === "sequence").length;
  const isFullyConcealed = melds.every((m) => !isOpenMeld(m));

  const suits = new Set(allSets.map((s) => s.suit));
  suits.add(decomposed.pair.suit);
  const numberedSuits = new Set([...suits].filter((s) => s === "man" || s === "pin" || s === "sou"));
  const honorSuits = new Set([...suits].filter((s) => s === "wind" || s === "dragon"));

  const dragonTriplets = allSets.filter((s) => s.type === "triplet" && s.suit === "dragon").length;
  const windTriplets = allSets.filter((s) => s.type === "triplet" && s.suit === "wind").length;
  const hasDragonPair = decomposed.pair.suit === "dragon";
  const hasWindPair = decomposed.pair.suit === "wind";

  // ---- Basic patterns ----
  if (isFullyConcealed) entries.push({ name: "門清", tai: 1 });
  if (selfDrawn) entries.push({ name: "自摸", tai: 1 });
  if (isFullyConcealed && totalSequenceCount === 5) entries.push({ name: "平胡", tai: 2 });
  if (totalTripletCount === 5) entries.push({ name: "碰碰胡", tai: 4 });

  // ---- Concealed triplet count ----
  if (concealedTripletCount === 5) entries.push({ name: "五暗刻", tai: 16 });
  else if (concealedTripletCount === 4) entries.push({ name: "四暗刻", tai: 5 });
  else if (concealedTripletCount === 3) entries.push({ name: "三暗刻", tai: 3 });

  // ---- Suit purity ----
  if (honorSuits.size > 0 && numberedSuits.size === 0) {
    entries.push({ name: "字一色", tai: 16 });
  } else if (numberedSuits.size === 1 && honorSuits.size === 0) {
    entries.push({ name: "清一色", tai: 8 });
  } else if (numberedSuits.size === 1 && honorSuits.size > 0) {
    entries.push({ name: "混一色", tai: 4 });
  }

  // ---- Dragons ----
  if (dragonTriplets === 3) entries.push({ name: "大三元", tai: 8 });
  else if (dragonTriplets === 2 && hasDragonPair) entries.push({ name: "小三元", tai: 4 });

  // ---- Winds ----
  if (windTriplets === 4) entries.push({ name: "大四喜", tai: 16 });
  else if (windTriplets === 3 && hasWindPair) entries.push({ name: "小四喜", tai: 8 });

  // ---- Fully-called hand ----
  if (melds.length === 4 && !selfDrawn) entries.push({ name: "全求人", tai: 2 });

  // ---- Situational ----
  if (input.wonOnKongReplacement) entries.push({ name: "槓上開花", tai: 1 });
  if (input.wonOnLastTile) entries.push({ name: "海底撈月", tai: 1 });
  if (input.wonByRobbingKong) entries.push({ name: "搶槓", tai: 1 });
  if (seat === dealerSeat) entries.push({ name: "莊家", tai: 1 });

  // ---- Flowers ----
  if (flowers.length > 0) entries.push({ name: "花牌", tai: flowers.length });

  return entries;
}

export function taiTotal(entries: TaiEntry[]): number {
  return entries.reduce((sum, e) => sum + e.tai, 0);
}

/** Points transferred per losing player, before dealer doubling. */
export function pointsForTai(tai: number): number {
  return tai * POINTS_PER_TAI;
}

export { POINTS_PER_TAI };
