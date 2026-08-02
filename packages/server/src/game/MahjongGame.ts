import {
  Tile,
  Meld,
  DiscardEntry,
  LegalAction,
  ClientAction,
  HandResult,
  HandResultWinner,
  sortTiles,
  isSameTileType,
  tileLabel,
} from "@mahjong/shared";
import { Wall } from "./Wall";
import { isWinningHand } from "./WinChecker";
import { computeTai, taiTotal, pointsForTai, MIN_TAI_TO_WIN, ScoringInput } from "./Scoring";

export interface ServerPlayer {
  seat: number;
  name: string;
  hand: Tile[];
  melds: Meld[];
  flowers: Tile[];
  score: number;
}

type TurnState = "awaiting-discard" | "awaiting-claims" | "awaiting-robbing" | "hand-over";

const CLAIM_WINDOW_MS = 12000;
const ROB_WINDOW_MS = 8000;

function nextSeat(s: number): number {
  return (s + 1) % 4;
}

export class MahjongGame {
  players: ServerPlayer[];
  wall: Wall;
  discardPile: DiscardEntry[] = [];
  dealerSeat = 0;
  roundWind = 1;
  handNumber = 1;
  currentTurnSeat: number | null = null;
  turnState: TurnState = "hand-over";
  phase: "playing" | "hand-end" = "hand-end";
  log: string[] = [];
  handResult?: HandResult;

  private pendingDiscard?: { tile: Tile; fromSeat: number };
  private pendingClaimOptions: Map<number, LegalAction[]> = new Map();
  private respondedClaims: Map<number, ClientAction> = new Map();
  private lastDrawWasKongReplacement = false;
  private claimDeadline?: number;
  private onClaimWindowOpen?: (ms: number) => void;
  private robAddedTile?: Tile;

  constructor(names: [string, string, string, string]) {
    this.wall = new Wall();
    this.players = names.map((name, seat) => ({
      seat,
      name,
      hand: [],
      melds: [],
      flowers: [],
      score: 0,
    }));
  }

  setClaimWindowCallback(cb: (ms: number) => void) {
    this.onClaimWindowOpen = cb;
  }

  private pushLog(line: string) {
    this.log.push(line);
    if (this.log.length > 80) this.log.shift();
  }

  getClaimDeadline(): number | undefined {
    return this.claimDeadline;
  }

  // ---------------------------------------------------------------------
  // Dealing
  // ---------------------------------------------------------------------

  startHand(opts?: { dealerSeat?: number; roundWind?: number; handNumber?: number }) {
    this.wall = new Wall();
    this.discardPile = [];
    this.handResult = undefined;
    this.pendingDiscard = undefined;
    this.pendingClaimOptions = new Map();
    this.respondedClaims = new Map();
    this.lastDrawWasKongReplacement = false;
    this.claimDeadline = undefined;
    if (opts?.dealerSeat !== undefined) this.dealerSeat = opts.dealerSeat;
    if (opts?.roundWind !== undefined) this.roundWind = opts.roundWind;
    if (opts?.handNumber !== undefined) this.handNumber = opts.handNumber;

    for (const p of this.players) {
      p.hand = [];
      p.melds = [];
      p.flowers = [];
    }

    for (let i = 0; i < 16; i++) {
      for (const p of this.players) {
        const t = this.wall.drawFromFront();
        if (t) p.hand.push(t);
      }
    }
    for (const p of this.players) {
      this.replaceFlowersInHand(p);
      p.hand = sortTiles(p.hand);
    }

    this.pushLog(`第 ${this.handNumber} 局開始，莊家為 ${this.players[this.dealerSeat].name}`);
    this.phase = "playing";
    this.currentTurnSeat = this.dealerSeat;
    this.turnState = "awaiting-discard";
    this.drawForCurrentPlayer();
  }

  private replaceFlowersInHand(p: ServerPlayer) {
    let again = true;
    while (again) {
      again = false;
      const flowerIdx = p.hand.findIndex((t) => t.suit === "flower");
      if (flowerIdx >= 0) {
        const [flower] = p.hand.splice(flowerIdx, 1);
        p.flowers.push(flower);
        const replacement = this.wall.drawReplacement();
        if (replacement) {
          p.hand.push(replacement);
          again = true;
        }
      }
    }
  }

  /** Draws for the current player, looping through any flowers. Returns the final non-flower tile (or null on wall exhaustion). */
  private drawForCurrentPlayer(fromReplacement = false): Tile | null {
    const p = this.players[this.currentTurnSeat!];
    let tile = fromReplacement ? this.wall.drawReplacement() : this.wall.drawFromFront();
    while (tile && tile.suit === "flower") {
      p.flowers.push(tile);
      tile = this.wall.drawReplacement();
    }
    if (!tile) {
      this.endHandAsDraw();
      return null;
    }
    p.hand.push(tile);
    p.hand = sortTiles(p.hand);
    this.lastDrawWasKongReplacement = fromReplacement;
    return tile;
  }

  // ---------------------------------------------------------------------
  // Legal action computation
  // ---------------------------------------------------------------------

  private findConcealedKongGroups(p: ServerPlayer): string[][] {
    const counts = new Map<string, Tile[]>();
    for (const t of p.hand) {
      const key = `${t.suit}${t.value}`;
      const arr = counts.get(key) ?? [];
      arr.push(t);
      counts.set(key, arr);
    }
    const groups: string[][] = [];
    for (const arr of counts.values()) {
      if (arr.length === 4) groups.push(arr.map((t) => t.id));
    }
    return groups;
  }

  private findAddedKongGroups(p: ServerPlayer): string[][] {
    const groups: string[][] = [];
    for (const meld of p.melds) {
      if (meld.type !== "pon") continue;
      const match = p.hand.find((t) => isSameTileType(t, meld.tiles[0]));
      if (match) groups.push([match.id]);
    }
    return groups;
  }

  private getMyTurnLegalActions(seat: number): LegalAction[] {
    const p = this.players[seat];
    const actions: LegalAction[] = [{ type: "discard" }];

    if (isWinningHand(p.hand, p.melds)) {
      const tai = this.scoreForWinner(seat, p.hand[p.hand.length - 1] ?? p.hand[0], true).total;
      if (tai >= MIN_TAI_TO_WIN) actions.push({ type: "hu", kind: "self" });
    }

    const concealedGroups = this.findConcealedKongGroups(p);
    if (concealedGroups.length > 0) actions.push({ type: "kong", kind: "concealed", groups: concealedGroups });

    const addedGroups = this.findAddedKongGroups(p);
    if (addedGroups.length > 0) actions.push({ type: "kong", kind: "added", groups: addedGroups });

    return actions;
  }

  private computeClaimOptionsFor(seat: number, discard: Tile, discarderSeat: number): LegalAction[] {
    const p = this.players[seat];
    const actions: LegalAction[] = [];

    const testHand = [...p.hand, discard];
    if (isWinningHand(testHand, p.melds)) {
      const tai = this.scoreForWinner(seat, discard, false).total;
      if (tai >= MIN_TAI_TO_WIN) actions.push({ type: "hu", kind: "discard" });
    }

    const matching = p.hand.filter((t) => isSameTileType(t, discard));
    if (matching.length >= 2) actions.push({ type: "pon", groups: [matching.slice(0, 2).map((t) => t.id)] });
    if (matching.length >= 3) actions.push({ type: "kong", kind: "exposed", groups: [matching.slice(0, 3).map((t) => t.id)] });

    if (seat === nextSeat(discarderSeat) && (discard.suit === "man" || discard.suit === "pin" || discard.suit === "sou")) {
      const byValue = (v: number) => p.hand.find((t) => t.suit === discard.suit && t.value === v);
      const chiGroups: string[][] = [];
      const combos = [
        [discard.value - 2, discard.value - 1],
        [discard.value - 1, discard.value + 1],
        [discard.value + 1, discard.value + 2],
      ];
      for (const [a, b] of combos) {
        if (a < 1 || b > 9) continue;
        const ta = byValue(a);
        const tb = byValue(b);
        if (ta && tb) chiGroups.push([ta.id, tb.id]);
      }
      if (chiGroups.length > 0) actions.push({ type: "chi", groups: chiGroups });
    }

    if (actions.length > 0) actions.push({ type: "pass" });
    return actions;
  }

  // ---------------------------------------------------------------------
  // Action dispatch
  // ---------------------------------------------------------------------

  handleAction(seat: number, action: ClientAction) {
    if (this.turnState === "awaiting-discard") {
      if (seat !== this.currentTurnSeat) throw new Error("還沒輪到你");
      if (action.type === "discard") return this.doDiscard(seat, action.tileId);
      if (action.type === "hu") return this.doSelfHu(seat);
      if (action.type === "kong") return this.doOwnTurnKong(seat, action.tileIds);
      throw new Error("目前無法執行此動作");
    }

    if (this.turnState === "awaiting-claims" || this.turnState === "awaiting-robbing") {
      const options = this.pendingClaimOptions.get(seat);
      if (!options || options.length === 0) throw new Error("目前沒有可以回應的動作");
      if (this.respondedClaims.has(seat)) throw new Error("已經回應過了");
      const allowed = options.some((o) => o.type === action.type);
      if (!allowed) throw new Error("不合法的動作");
      this.respondedClaims.set(seat, action);
      this.maybeResolveClaims();
      return;
    }

    throw new Error("目前無法執行此動作");
  }

  private doDiscard(seat: number, tileId: string) {
    const p = this.players[seat];
    const idx = p.hand.findIndex((t) => t.id === tileId);
    if (idx < 0) throw new Error("手牌中沒有這張牌");
    const [tile] = p.hand.splice(idx, 1);
    this.discardPile.push({ tile, fromSeat: seat });
    this.pushLog(`${p.name} 打出 ${tileLabel(tile)}`);
    this.pendingDiscard = { tile, fromSeat: seat };
    this.openClaimWindow(tile, seat);
  }

  private doSelfHu(seat: number) {
    const p = this.players[seat];
    const winTile = p.hand[p.hand.length - 1];
    if (!isWinningHand(p.hand, p.melds)) throw new Error("目前手牌尚未胡牌");
    const { total } = this.scoreForWinner(seat, winTile, true);
    if (total < MIN_TAI_TO_WIN) throw new Error("台數不足，尚不能胡牌");
    this.finishHand(
      [
        {
          seat,
          winTile,
          selfDrawn: true,
        },
      ],
      undefined
    );
  }

  private doOwnTurnKong(seat: number, tileIds: string[]) {
    const p = this.players[seat];
    if (tileIds.length === 4) {
      const groups = this.findConcealedKongGroups(p);
      const match = groups.find((g) => g.every((id) => tileIds.includes(id)));
      if (!match) throw new Error("不能暗槓");
      const tiles = tileIds.map((id) => {
        const t = p.hand.find((h) => h.id === id)!;
        return t;
      });
      p.hand = p.hand.filter((t) => !tileIds.includes(t.id));
      p.melds.push({ type: "kong-concealed", tiles });
      this.pushLog(`${p.name} 暗槓 ${tileLabel(tiles[0])}`);
      this.drawForCurrentPlayer(true);
      return;
    }
    if (tileIds.length === 1) {
      const meldIdx = p.melds.findIndex(
        (m) => m.type === "pon" && p.hand.some((t) => t.id === tileIds[0] && isSameTileType(t, m.tiles[0]))
      );
      if (meldIdx < 0) throw new Error("不能加槓");
      const handIdx = p.hand.findIndex((t) => t.id === tileIds[0]);
      const [addedTile] = p.hand.splice(handIdx, 1);
      const meld = p.melds[meldIdx];
      meld.type = "kong-added";
      meld.tiles = [...meld.tiles, addedTile];
      this.pushLog(`${p.name} 加槓 ${tileLabel(addedTile)}`);
      this.openRobKongWindow(seat, addedTile);
      return;
    }
    throw new Error("槓牌張數不對");
  }

  // ---------------------------------------------------------------------
  // Claim window (chi / pon / kong / hu on a discard)
  // ---------------------------------------------------------------------

  private openClaimWindow(discard: Tile, fromSeat: number) {
    this.pendingClaimOptions = new Map();
    this.respondedClaims = new Map();
    for (const p of this.players) {
      if (p.seat === fromSeat) continue;
      const opts = this.computeClaimOptionsFor(p.seat, discard, fromSeat);
      if (opts.length > 0) this.pendingClaimOptions.set(p.seat, opts);
    }
    if (this.pendingClaimOptions.size === 0) {
      this.advanceAfterNoClaims();
      return;
    }
    this.turnState = "awaiting-claims";
    this.claimDeadline = Date.now() + CLAIM_WINDOW_MS;
    this.onClaimWindowOpen?.(CLAIM_WINDOW_MS);
  }

  private openRobKongWindow(kongSeat: number, addedTile: Tile) {
    this.pendingClaimOptions = new Map();
    this.respondedClaims = new Map();
    for (const p of this.players) {
      if (p.seat === kongSeat) continue;
      const testHand = [...p.hand, addedTile];
      if (isWinningHand(testHand, p.melds)) {
        const tai = this.scoreForWinner(p.seat, addedTile, false).total;
        if (tai >= MIN_TAI_TO_WIN) {
          this.pendingClaimOptions.set(p.seat, [{ type: "hu", kind: "discard" }, { type: "pass" }]);
        }
      }
    }
    if (this.pendingClaimOptions.size === 0) {
      // Nobody can rob the kong; complete it normally.
      this.currentTurnSeat = kongSeat;
      this.drawForCurrentPlayer(true);
      this.turnState = "awaiting-discard";
      return;
    }
    this.currentTurnSeat = kongSeat;
    this.turnState = "awaiting-robbing";
    this.claimDeadline = Date.now() + ROB_WINDOW_MS;
    this.robAddedTile = addedTile;
    this.onClaimWindowOpen?.(ROB_WINDOW_MS);
  }

  /** Called by the room manager when the claim window timer expires. Safe to call redundantly. */
  forceResolveClaims() {
    this.maybeResolveClaims(true);
  }

  private maybeResolveClaims(forced = false) {
    if (this.turnState !== "awaiting-claims" && this.turnState !== "awaiting-robbing") return;
    const allResponded = [...this.pendingClaimOptions.keys()].every((seat) => this.respondedClaims.has(seat));
    if (!forced && !allResponded) return;
    this.resolveClaims();
  }

  private resolveClaims() {
    if (this.turnState === "awaiting-robbing") {
      const robbers = [...this.pendingClaimOptions.keys()].filter((seat) => this.respondedClaims.get(seat)?.type === "hu");
      const addedTile = this.robAddedTile!;
      const kongSeat = this.currentTurnSeat!;
      this.claimDeadline = undefined;
      if (robbers.length > 0) {
        this.finishHand(
          robbers.map((seat) => ({ seat, winTile: addedTile, selfDrawn: false, wonByRobbingKong: true })),
          kongSeat
        );
        return;
      }
      this.currentTurnSeat = kongSeat;
      this.drawForCurrentPlayer(true);
      this.turnState = "awaiting-discard";
      return;
    }

    const discard = this.pendingDiscard!;
    this.claimDeadline = undefined;

    const huSeats = [...this.pendingClaimOptions.keys()].filter((seat) => this.respondedClaims.get(seat)?.type === "hu");
    if (huSeats.length > 0) {
      this.finishHand(
        huSeats.map((seat) => ({ seat, winTile: discard.tile, selfDrawn: false })),
        discard.fromSeat
      );
      return;
    }

    const kongSeat = [...this.pendingClaimOptions.keys()].find((seat) => this.respondedClaims.get(seat)?.type === "kong");
    if (kongSeat !== undefined) {
      const action = this.respondedClaims.get(kongSeat) as Extract<ClientAction, { type: "kong" }>;
      const p = this.players[kongSeat];
      const tiles = action.tileIds.map((id) => p.hand.find((t) => t.id === id)!);
      p.hand = p.hand.filter((t) => !action.tileIds.includes(t.id));
      p.melds.push({ type: "kong-exposed", tiles: [...tiles, discard.tile], fromSeat: discard.fromSeat, calledTileId: discard.tile.id });
      this.discardPile[this.discardPile.length - 1].claimedBySeat = kongSeat;
      this.pushLog(`${p.name} 槓 ${tileLabel(discard.tile)}`);
      this.currentTurnSeat = kongSeat;
      this.drawForCurrentPlayer(true);
      this.turnState = "awaiting-discard";
      return;
    }

    const ponSeat = [...this.pendingClaimOptions.keys()].find((seat) => this.respondedClaims.get(seat)?.type === "pon");
    if (ponSeat !== undefined) {
      const action = this.respondedClaims.get(ponSeat) as Extract<ClientAction, { type: "pon" }>;
      const p = this.players[ponSeat];
      const tiles = action.tileIds.map((id) => p.hand.find((t) => t.id === id)!);
      p.hand = p.hand.filter((t) => !action.tileIds.includes(t.id));
      p.melds.push({ type: "pon", tiles: [...tiles, discard.tile], fromSeat: discard.fromSeat, calledTileId: discard.tile.id });
      this.discardPile[this.discardPile.length - 1].claimedBySeat = ponSeat;
      this.pushLog(`${p.name} 碰 ${tileLabel(discard.tile)}`);
      this.currentTurnSeat = ponSeat;
      this.turnState = "awaiting-discard";
      this.lastDrawWasKongReplacement = false;
      return;
    }

    const chiSeat = [...this.pendingClaimOptions.keys()].find((seat) => this.respondedClaims.get(seat)?.type === "chi");
    if (chiSeat !== undefined) {
      const action = this.respondedClaims.get(chiSeat) as Extract<ClientAction, { type: "chi" }>;
      const p = this.players[chiSeat];
      const tiles = action.tileIds.map((id) => p.hand.find((t) => t.id === id)!);
      p.hand = p.hand.filter((t) => !action.tileIds.includes(t.id));
      const meldTiles = sortTiles([...tiles, discard.tile]);
      p.melds.push({ type: "chi", tiles: meldTiles, fromSeat: discard.fromSeat, calledTileId: discard.tile.id });
      this.discardPile[this.discardPile.length - 1].claimedBySeat = chiSeat;
      this.pushLog(`${p.name} 吃 ${tileLabel(discard.tile)}`);
      this.currentTurnSeat = chiSeat;
      this.turnState = "awaiting-discard";
      this.lastDrawWasKongReplacement = false;
      return;
    }

    this.advanceAfterNoClaims();
  }

  private advanceAfterNoClaims() {
    if (this.wall.isEmpty()) {
      this.endHandAsDraw();
      return;
    }
    const discarderSeat = this.pendingDiscard?.fromSeat ?? this.currentTurnSeat!;
    this.currentTurnSeat = nextSeat(discarderSeat);
    this.turnState = "awaiting-discard";
    this.drawForCurrentPlayer(false);
  }

  // ---------------------------------------------------------------------
  // Scoring / hand end
  // ---------------------------------------------------------------------

  private scoreForWinner(
    seat: number,
    winTile: Tile,
    selfDrawn: boolean,
    extra?: { wonByRobbingKong?: boolean }
  ): { entries: ReturnType<typeof computeTai>; total: number } {
    const p = this.players[seat];
    const concealedTiles = selfDrawn ? p.hand : [...p.hand, winTile];
    const input: ScoringInput = {
      seat,
      dealerSeat: this.dealerSeat,
      concealedTiles,
      melds: p.melds,
      winningTile: winTile,
      selfDrawn,
      flowers: p.flowers,
      wonOnKongReplacement: selfDrawn && this.lastDrawWasKongReplacement,
      wonOnLastTile: this.wall.isEmpty(),
      wonByRobbingKong: extra?.wonByRobbingKong ?? false,
    };
    const entries = computeTai(input);
    return { entries, total: taiTotal(entries) };
  }

  private finishHand(
    winners: { seat: number; winTile: Tile; selfDrawn: boolean; wonByRobbingKong?: boolean }[],
    loserSeat: number | undefined
  ) {
    const pointsDelta = [0, 0, 0, 0];
    const resultWinners: HandResultWinner[] = [];

    for (const w of winners) {
      const { entries, total } = this.scoreForWinner(w.seat, w.winTile, w.selfDrawn, {
        wonByRobbingKong: w.wonByRobbingKong,
      });
      const isDealer = w.seat === this.dealerSeat;
      const multiplier = isDealer ? 2 : 1;
      const unit = pointsForTai(total) * multiplier;

      if (w.selfDrawn) {
        for (const other of this.players) {
          if (other.seat === w.seat) continue;
          pointsDelta[other.seat] -= unit;
          pointsDelta[w.seat] += unit;
        }
      } else if (loserSeat !== undefined) {
        const amount = unit * 2;
        pointsDelta[loserSeat] -= amount;
        pointsDelta[w.seat] += amount;
      }

      resultWinners.push({
        seat: w.seat,
        taiCount: total,
        taiBreakdown: entries,
        points: pointsDelta[w.seat],
        winTile: w.winTile,
        selfDrawn: w.selfDrawn,
      });
      this.pushLog(`${this.players[w.seat].name} 胡牌！${total} 台`);
    }

    for (const p of this.players) p.score += pointsDelta[p.seat];

    const dealerWon = winners.some((w) => w.seat === this.dealerSeat);
    const dealerContinues = dealerWon;

    this.handResult = {
      winners: resultWinners,
      loserSeat,
      drawGame: false,
      pointsDelta,
      dealerContinues,
    };
    this.turnState = "hand-over";
    this.phase = "hand-end";
    this.currentTurnSeat = null;
  }

  private endHandAsDraw() {
    this.pushLog("流局，本局無人胡牌");
    this.handResult = {
      winners: [],
      drawGame: true,
      pointsDelta: [0, 0, 0, 0],
      dealerContinues: true,
    };
    this.turnState = "hand-over";
    this.phase = "hand-end";
    this.currentTurnSeat = null;
  }

  advanceToNextHand() {
    const result = this.handResult;
    let nextDealer = this.dealerSeat;
    let nextHandNumber = this.handNumber + 1;
    if (!result?.dealerContinues) nextDealer = nextSeat(this.dealerSeat);
    this.startHand({ dealerSeat: nextDealer, handNumber: nextHandNumber });
  }

  // ---------------------------------------------------------------------
  // View
  // ---------------------------------------------------------------------

  getLegalActionsFor(seat: number): LegalAction[] {
    if (this.turnState === "awaiting-discard" && seat === this.currentTurnSeat) {
      return this.getMyTurnLegalActions(seat);
    }
    if (this.turnState === "awaiting-claims" || this.turnState === "awaiting-robbing") {
      if (this.respondedClaims.has(seat)) return [];
      return this.pendingClaimOptions.get(seat) ?? [];
    }
    return [];
  }
}
