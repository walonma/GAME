import { describe, it, expect } from "vitest";
import { isWinningHand } from "../game/WinChecker";
import { hand, t } from "./testUtils";
import { Meld } from "@mahjong/shared";

describe("isWinningHand", () => {
  it("accepts a standard hand: 4 sequences + 1 triplet + pair (17 tiles, no melds)", () => {
    const tiles = hand("1m2m3m 4m5m6m 7m8m9m 1p2p3p 5s5s5s 9p9p");
    expect(tiles.length).toBe(17);
    expect(isWinningHand(tiles, [])).toBe(true);
  });

  it("accepts all-triplets (碰碰胡) hand", () => {
    const tiles = hand("1m1m1m 5p5p5p 9s9s9s 2w2w2w 3d3d3d 7m7m");
    expect(isWinningHand(tiles, [])).toBe(true);
  });

  it("rejects a hand that is one tile short", () => {
    const tiles = hand("1m2m3m 4m5m6m 7m8m9m 1p2p3p 5s5s 9p9p");
    expect(tiles.length).toBe(16);
    expect(isWinningHand(tiles, [])).toBe(false);
  });

  it("rejects a non-decomposable hand", () => {
    const tiles = hand("1m2m4m 5m5m6m 7m8m9m 1p2p3p 5s5s5s 9p9p");
    expect(isWinningHand(tiles, [])).toBe(false);
  });

  it("accounts for exposed melds reducing the sets needed from the concealed hand", () => {
    const melds: Meld[] = [
      { type: "pon", tiles: [t("dragon", 1), t("dragon", 1), t("dragon", 1)] },
      { type: "chi", tiles: [t("man", 1), t("man", 2), t("man", 3)] },
    ];
    // 5 - 2 melds = 3 sets needed + pair = 11 concealed tiles
    const tiles = hand("4m5m6m 7m8m9m 1p2p3p 9p9p");
    expect(tiles.length).toBe(11);
    expect(isWinningHand(tiles, melds)).toBe(true);
  });

  it("honors cannot form sequences", () => {
    const tiles = hand("1m2m3m 4m5m6m 7m8m9m 1p2p3p 1w2w3w 9s9s");
    expect(tiles.length).toBe(17);
    expect(isWinningHand(tiles, [])).toBe(false);
  });

  it("flowers can never be part of a winning decomposition", () => {
    const tiles = [...hand("1m2m3m 4m5m6m 7m8m9m 1p2p3p 5s5s 9p9p"), t("flower", 1)];
    expect(tiles.length).toBe(17);
    expect(isWinningHand(tiles, [])).toBe(false);
  });
});
