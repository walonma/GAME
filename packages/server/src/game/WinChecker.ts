import { Tile, Suit } from "@mahjong/shared";
import { Meld } from "@mahjong/shared";

const SUIT_ORDER: Record<Suit, number> = { man: 0, pin: 1, sou: 2, wind: 3, dragon: 4, flower: 9 };

/** Numeric sort key so "take the smallest remaining tile" decomposition is deterministic. */
function sortKey(suit: Suit, value: number): number {
  return SUIT_ORDER[suit] * 100 + value;
}

type CountMap = Map<number, { suit: Suit; value: number; count: number }>;

function buildCounts(tiles: Tile[]): CountMap {
  const m: CountMap = new Map();
  for (const t of tiles) {
    const k = sortKey(t.suit, t.value);
    const existing = m.get(k);
    if (existing) existing.count++;
    else m.set(k, { suit: t.suit, value: t.value, count: 1 });
  }
  return m;
}

function isNumberedSuit(suit: Suit): boolean {
  return suit === "man" || suit === "pin" || suit === "sou";
}

/** Recursively try to decompose the multiset into exactly `setsNeeded` triplets/sequences. */
function canDecompose(counts: CountMap, setsNeeded: number): boolean {
  // Find smallest tile type with count > 0.
  let smallestKey: number | undefined;
  for (const [k, v] of counts) {
    if (v.count > 0 && (smallestKey === undefined || k < smallestKey)) smallestKey = k;
  }
  if (smallestKey === undefined) return setsNeeded === 0;
  if (setsNeeded === 0) return false;

  const entry = counts.get(smallestKey)!;

  // Option 1: triplet
  if (entry.count >= 3) {
    entry.count -= 3;
    if (canDecompose(counts, setsNeeded - 1)) {
      entry.count += 3;
      return true;
    }
    entry.count += 3;
  }

  // Option 2: sequence (numbered suits only, value <= 7)
  if (isNumberedSuit(entry.suit) && entry.value <= 7) {
    const k2 = sortKey(entry.suit, entry.value + 1);
    const k3 = sortKey(entry.suit, entry.value + 2);
    const e2 = counts.get(k2);
    const e3 = counts.get(k3);
    if (e2 && e2.count > 0 && e3 && e3.count > 0) {
      entry.count -= 1;
      e2.count -= 1;
      e3.count -= 1;
      if (canDecompose(counts, setsNeeded - 1)) {
        entry.count += 1;
        e2.count += 1;
        e3.count += 1;
        return true;
      }
      entry.count += 1;
      e2.count += 1;
      e3.count += 1;
    }
  }

  return false;
}

/**
 * A Taiwan-mahjong winning hand = 5 sets (triplet/sequence/kong) + 1 pair = 17 tiles.
 * `concealedTiles` is the player's non-melded hand INCLUDING the winning tile.
 * `melds` are already-declared exposed/concealed melds (each counts as one set).
 */
export function isWinningHand(concealedTiles: Tile[], melds: Meld[]): boolean {
  const setsNeeded = 5 - melds.length;
  if (setsNeeded < 0) return false;
  if (concealedTiles.length !== setsNeeded * 3 + 2) return false;
  if (concealedTiles.some((t) => t.suit === "flower")) return false;

  const baseCounts = buildCounts(concealedTiles);
  const pairCandidates = [...baseCounts.entries()].filter(([, v]) => v.count >= 2);

  for (const [, candidate] of pairCandidates) {
    candidate.count -= 2;
    const ok = canDecompose(baseCounts, setsNeeded);
    candidate.count += 2;
    if (ok) return true;
  }
  return false;
}

/** Returns the decomposition (used by the scorer) for one valid winning arrangement, or null. */
export interface DecomposedHand {
  pair: { suit: Suit; value: number };
  sets: { suit: Suit; value: number; type: "triplet" | "sequence" }[];
}

export function decomposeWinningHand(concealedTiles: Tile[], melds: Meld[]): DecomposedHand | null {
  const setsNeeded = 5 - melds.length;
  if (setsNeeded < 0) return null;
  if (concealedTiles.length !== setsNeeded * 3 + 2) return null;

  const baseCounts = buildCounts(concealedTiles);
  const pairCandidates = [...baseCounts.entries()].filter(([, v]) => v.count >= 2);

  for (const [, candidate] of pairCandidates) {
    candidate.count -= 2;
    const sets: DecomposedHand["sets"] = [];
    if (decomposeCollect(baseCounts, setsNeeded, sets)) {
      candidate.count += 2;
      return { pair: { suit: candidate.suit, value: candidate.value }, sets };
    }
    candidate.count += 2;
  }
  return null;
}

function decomposeCollect(counts: CountMap, setsNeeded: number, out: DecomposedHand["sets"]): boolean {
  let smallestKey: number | undefined;
  for (const [k, v] of counts) {
    if (v.count > 0 && (smallestKey === undefined || k < smallestKey)) smallestKey = k;
  }
  if (smallestKey === undefined) return setsNeeded === 0;
  if (setsNeeded === 0) return false;

  const entry = counts.get(smallestKey)!;

  if (entry.count >= 3) {
    entry.count -= 3;
    out.push({ suit: entry.suit, value: entry.value, type: "triplet" });
    if (decomposeCollect(counts, setsNeeded - 1, out)) return true;
    out.pop();
    entry.count += 3;
  }

  if (isNumberedSuit(entry.suit) && entry.value <= 7) {
    const k2 = sortKey(entry.suit, entry.value + 1);
    const k3 = sortKey(entry.suit, entry.value + 2);
    const e2 = counts.get(k2);
    const e3 = counts.get(k3);
    if (e2 && e2.count > 0 && e3 && e3.count > 0) {
      entry.count -= 1;
      e2.count -= 1;
      e3.count -= 1;
      out.push({ suit: entry.suit, value: entry.value, type: "sequence" });
      if (decomposeCollect(counts, setsNeeded - 1, out)) return true;
      out.pop();
      entry.count += 1;
      e2.count += 1;
      e3.count += 1;
    }
  }

  return false;
}
