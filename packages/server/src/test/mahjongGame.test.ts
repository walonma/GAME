import { describe, it, expect } from "vitest";
import { MahjongGame } from "../game/MahjongGame";
import { Wall } from "../game/Wall";
import { hand, t } from "./testUtils";
import { LegalAction } from "@mahjong/shared";

function freshGame() {
  const g = new MahjongGame(["East", "South", "West", "North"]);
  g.startHand({ dealerSeat: 0, roundWind: 1, handNumber: 1 });
  return g;
}

describe("MahjongGame turn flow", () => {
  it("deals 16 tiles to each player and draws a 17th for the dealer", () => {
    const g = freshGame();
    expect(g.players[0].hand.length).toBe(17);
    expect(g.players[1].hand.length).toBe(16);
    expect(g.players[2].hand.length).toBe(16);
    expect(g.players[3].hand.length).toBe(16);
    expect(g.currentTurnSeat).toBe(0);
    expect(g.turnState).toBe("awaiting-discard");
  });

  it("discard -> pon moves the turn to the claimant without drawing", () => {
    const g = freshGame();
    g.players[0].hand = [t("pin", 5), ...hand("1m1m1m 2m2m2m 3m3m3m 4m4m4m")];
    g.players[1].hand = [t("pin", 5), t("pin", 5), ...hand("9s9s9s 8s8s8s")];
    g.players[2].hand = [];
    g.players[3].hand = [];
    const handCountBefore = g.players[1].hand.length;

    const discardId = g.players[0].hand[0].id;
    g.handleAction(0, { type: "discard", tileId: discardId });
    expect(g.turnState).toBe("awaiting-claims");

    const ponAction = g.getLegalActionsFor(1).find((a) => a.type === "pon") as Extract<LegalAction, { type: "pon" }>;
    expect(ponAction).toBeTruthy();
    g.handleAction(1, { type: "pon", tileIds: ponAction.groups[0] });

    expect(g.turnState).toBe("awaiting-discard");
    expect(g.currentTurnSeat).toBe(1);
    expect(g.players[1].melds.length).toBe(1);
    expect(g.players[1].melds[0].type).toBe("pon");
    expect(g.players[1].hand.length).toBe(handCountBefore - 2);
  });

  it("only the next seat may chi, and it removes the correct tiles", () => {
    const g = freshGame();
    g.players[0].hand = [t("man", 5), ...hand("1p1p1p 2p2p2p 3p3p3p 4p4p4p")];
    g.players[1].hand = [t("man", 4), t("man", 6), ...hand("9s9s9s 8s8s8s")];
    g.players[2].hand = [t("man", 4), t("man", 6), ...hand("9s9s9s 8s8s8s")];
    g.players[3].hand = [];

    const discardId = g.players[0].hand[0].id;
    g.handleAction(0, { type: "discard", tileId: discardId });

    // seat 2 (not the next seat) must not see a chi option, even though they hold matching tiles
    expect(g.getLegalActionsFor(2).some((a) => a.type === "chi")).toBe(false);

    const chiAction = g.getLegalActionsFor(1).find((a) => a.type === "chi") as Extract<LegalAction, { type: "chi" }>;
    expect(chiAction).toBeTruthy();
    g.handleAction(1, { type: "chi", tileIds: chiAction.groups[0] });

    expect(g.currentTurnSeat).toBe(1);
    expect(g.players[1].melds[0].type).toBe("chi");
    expect(g.players[1].melds[0].tiles.map((x) => x.value).sort()).toEqual([4, 5, 6]);
  });

  it("concealed kong draws a replacement tile and keeps the same player's turn", () => {
    const g = freshGame();
    g.players[0].hand = [...hand("3s3s3s3s"), ...hand("1m1m1m 2m2m2m 3m3m3m 4m4m4m")];
    g.wall = new Wall(hand("9s")); // next draw (replacement) tile

    g.handleAction(0, { type: "kong", tileIds: g.players[0].hand.slice(0, 4).map((x) => x.id) });

    expect(g.players[0].melds.length).toBe(1);
    expect(g.players[0].melds[0].type).toBe("kong-concealed");
    expect(g.turnState).toBe("awaiting-discard");
    expect(g.currentTurnSeat).toBe(0);
    // 16 tiles - 4 (kong) + 1 (replacement) = 13
    expect(g.players[0].hand.length).toBe(13);
  });

  it("self-draw hu ends the hand and pays double for the dealer", () => {
    const g = freshGame();
    g.players[0].hand = hand("1m2m3m 4m5m6m 7m8m9m 1p2p3p 4p5p6p 9p9p");
    g.players[0].flowers = []; // the real (random) deal may have dealt flowers; keep this test deterministic
    expect(g.players[0].hand.length).toBe(17);

    g.handleAction(0, { type: "hu" });

    expect(g.phase).toBe("hand-end");
    expect(g.handResult?.drawGame).toBe(false);
    expect(g.handResult?.winners.length).toBe(1);
    const winner = g.handResult!.winners[0];
    expect(winner.seat).toBe(0);
    expect(winner.selfDrawn).toBe(true);
    // 門清(1) + 平胡(2) + 自摸(1) + 莊家(1) = 5 tai, dealer self-draw => 5*100*2 = 1000 per opponent
    expect(winner.taiCount).toBe(5);
    expect(g.players[0].score).toBe(3000);
    expect(g.players[1].score).toBe(-1000);
    expect(g.players[2].score).toBe(-1000);
    expect(g.players[3].score).toBe(-1000);
  });

  it("rejects a self-draw hu declaration when the hand is not actually complete", () => {
    const g = freshGame();
    g.players[0].hand = hand("1m2m4m 5m5m6m 7m8m9m 1p2p3p 4p5p6p 9p9p");
    expect(() => g.handleAction(0, { type: "hu" })).toThrow();
  });

  it("ends the hand as a draw when the wall is exhausted with nobody winning", () => {
    const g = freshGame();
    // Force the wall empty so the very next draw fails, and make sure nobody can claim the discard.
    g.wall = new Wall([]);
    g.players[0].hand = [t("pin", 5), ...hand("1m1m1m 2m2m2m 3m3m3m 4m4m4m")];
    g.players[1].hand = [];
    g.players[2].hand = [];
    g.players[3].hand = [];
    const discardId = g.players[0].hand[0].id;
    g.handleAction(0, { type: "discard", tileId: discardId });
    // nobody can claim -> engine tries to draw for seat 1, wall is empty -> draw game
    expect(g.phase).toBe("hand-end");
    expect(g.handResult?.drawGame).toBe(true);
    expect(g.handResult?.dealerContinues).toBe(true);
  });

  it("advanceToNextHand keeps the dealer on a draw, and rotates it after a non-dealer win", () => {
    const g = freshGame();
    g.wall = new Wall([]);
    g.players[0].hand = [t("pin", 5), ...hand("1m1m1m 2m2m2m 3m3m3m 4m4m4m")];
    g.players[1].hand = [];
    g.players[2].hand = [];
    g.players[3].hand = [];
    g.handleAction(0, { type: "discard", tileId: g.players[0].hand[0].id });
    expect(g.handResult?.dealerContinues).toBe(true);

    g.advanceToNextHand();
    expect(g.dealerSeat).toBe(0);
    expect(g.handNumber).toBe(2);

    // Now simulate seat 1 (non-dealer) winning by self-draw; dealer should rotate to seat 1.
    g.players[1].hand = hand("1m2m3m 4m5m6m 7m8m9m 1p2p3p 4p5p6p 9p9p");
    g.currentTurnSeat = 1;
    g.turnState = "awaiting-discard";
    g.handleAction(1, { type: "hu" });
    expect(g.handResult?.dealerContinues).toBe(false);

    g.advanceToNextHand();
    expect(g.dealerSeat).toBe(1);
    expect(g.handNumber).toBe(3);
  });
});
