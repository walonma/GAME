import { describe, it, expect } from "vitest";
import { chooseBotAction } from "../game/Bot";
import { MahjongGame } from "../game/MahjongGame";
import { hand, t } from "./testUtils";

function freshGame() {
  const g = new MahjongGame(["East", "South", "West", "North"]);
  g.startHand({ dealerSeat: 0, roundWind: 1, handNumber: 1 });
  return g;
}

describe("chooseBotAction", () => {
  it("always takes a winning hand instead of discarding", () => {
    const g = freshGame();
    g.players[0].hand = hand("1m2m3m 4m5m6m 7m8m9m 1p2p3p 4p5p6p 9p9p");
    const action = chooseBotAction(g, 0);
    expect(action).toEqual({ type: "hu" });
  });

  it("always claims an available kong over passing", () => {
    const g = freshGame();
    g.players[0].hand = [...hand("3s3s3s3s"), ...hand("1m1m1m 2m2m2m 3m3m3m 4m4m4m")];
    const action = chooseBotAction(g, 0);
    expect(action.type).toBe("kong");
  });

  it("discards a lone honor tile before an isolated numbered tile or a paired tile", () => {
    const g = freshGame();
    // 1w is a lone honor (worst to keep), 5m is isolated (no neighbors), 9m9m is a pair (best to keep).
    g.players[0].hand = [t("wind", 1), t("man", 5), t("man", 9), t("man", 9), ...hand("1p2p3p 4p5p6p 7p8p9p")];
    const action = chooseBotAction(g, 0);
    expect(action).toEqual({ type: "discard", tileId: g.players[0].hand[0].id });
    expect(g.players[0].hand[0].suit).toBe("wind");
  });

  it("prefers to keep a tile with run-potential neighbors over a fully isolated one", () => {
    const g = freshGame();
    // 5m has a neighbor (4m) giving it run-potential; 1m/9m style isolated pin (no neighbors) should go first.
    g.players[0].hand = [t("pin", 1), t("man", 4), t("man", 5), t("man", 9), t("man", 9), ...hand("1s2s3s 4s5s6s")];
    const action = chooseBotAction(g, 0);
    expect(action.type).toBe("discard");
    if (action.type === "discard") {
      const discarded = g.players[0].hand.find((x) => x.id === action.tileId)!;
      expect(discarded.suit).toBe("pin");
      expect(discarded.value).toBe(1);
    }
  });

  it("falls back to pass when no legal action exists for that seat", () => {
    const g = freshGame();
    // Seat 1 hasn't drawn/discarded and there's no pending claim window - nothing to do.
    const action = chooseBotAction(g, 1);
    expect(action).toEqual({ type: "pass" });
  });
});
