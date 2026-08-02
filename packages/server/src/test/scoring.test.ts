import { describe, it, expect } from "vitest";
import { computeTai, taiTotal, ScoringInput } from "../game/Scoring";
import { hand, t } from "./testUtils";

function baseInput(overrides: Partial<ScoringInput>): ScoringInput {
  return {
    seat: 1,
    dealerSeat: 0,
    concealedTiles: [],
    melds: [],
    winningTile: t("man", 1),
    selfDrawn: false,
    flowers: [],
    wonOnKongReplacement: false,
    wonOnLastTile: false,
    wonByRobbingKong: false,
    ...overrides,
  };
}

// 5 sequences (all man/pin), no triplets: 門清 + 平胡.
const ALL_SEQUENCE_HAND = "1m2m3m 4m5m6m 7m8m9m 1p2p3p 4p5p6p 9p9p";

describe("computeTai", () => {
  it("scores a concealed all-sequence hand as 門清 + 平胡", () => {
    const tiles = hand(ALL_SEQUENCE_HAND);
    expect(tiles.length).toBe(17);
    const entries = computeTai(baseInput({ concealedTiles: tiles }));
    const names = entries.map((e) => e.name);
    expect(names).toContain("門清");
    expect(names).toContain("平胡");
    expect(names).not.toContain("碰碰胡");
  });

  it("scores an all-triplet concealed hand as 碰碰胡 plus five-concealed-triplet bonus", () => {
    // All 5 sets are concealed triplets -> 碰碰胡 and 五暗刻 (the highest concealed-triplet bonus).
    const tiles = hand("1m1m1m 5p5p5p 9s9s9s 2w2w2w 3d3d3d 7m7m");
    expect(tiles.length).toBe(17);
    const entries = computeTai(baseInput({ concealedTiles: tiles }));
    const names = entries.map((e) => e.name);
    expect(names).toContain("碰碰胡");
    expect(names).toContain("五暗刻");
  });

  it("scores 清一色 for a single-suit hand with no honors", () => {
    const tiles = hand("1s2s3s 4s5s6s 7s8s9s 2s3s4s 5s6s7s 9s9s");
    expect(tiles.length).toBe(17);
    const entries = computeTai(baseInput({ concealedTiles: tiles }));
    expect(entries.map((e) => e.name)).toContain("清一色");
  });

  it("scores 混一色 for a single suit plus honors", () => {
    const tiles = hand("1s2s3s 4s5s6s 7s8s9s 2s3s4s 1w1w1w 9s9s");
    expect(tiles.length).toBe(17);
    const entries = computeTai(baseInput({ concealedTiles: tiles }));
    expect(entries.map((e) => e.name)).toContain("混一色");
  });

  it("scores 大三元 for three dragon triplets", () => {
    const tiles = hand("1d1d1d 2d2d2d 3d3d3d 4m5m6m 7p8p9p 9p9p");
    expect(tiles.length).toBe(17);
    const entries = computeTai(baseInput({ concealedTiles: tiles }));
    expect(entries.map((e) => e.name)).toContain("大三元");
  });

  it("adds 自摸 and 莊家 tai appropriately", () => {
    const tiles = hand(ALL_SEQUENCE_HAND);
    const entries = computeTai(baseInput({ concealedTiles: tiles, selfDrawn: true, seat: 0, dealerSeat: 0 }));
    const names = entries.map((e) => e.name);
    expect(names).toContain("自摸");
    expect(names).toContain("莊家");
  });

  it("adds one 台 per flower tile held", () => {
    const tiles = hand(ALL_SEQUENCE_HAND);
    const entries = computeTai(baseInput({ concealedTiles: tiles, flowers: [t("flower", 1), t("flower", 5)] }));
    const flowerEntry = entries.find((e) => e.name === "花牌");
    expect(flowerEntry?.tai).toBe(2);
  });

  it("returns an empty breakdown (0 tai) for a non-winning hand", () => {
    const tiles = hand("1m2m4m 5m5m6m 7m8m9m 1p2p3p 5s5s5s 9p9p");
    const entries = computeTai(baseInput({ concealedTiles: tiles }));
    expect(taiTotal(entries)).toBe(0);
  });
});
