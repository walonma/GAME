import { GameStateView, PublicPlayerView, sortTiles, WIND_NAMES } from "@mahjong/shared";
import { MahjongGame } from "../game/MahjongGame";

export interface RoomPlayer {
  seat: number;
  token: string;
  name: string;
  socketId: string | null;
  connected: boolean;
  ready: boolean;
  isBot: boolean;
}

let botCounter = 0;

export class Room {
  code: string;
  players: (RoomPlayer | null)[] = [null, null, null, null];
  hostToken: string;
  game?: MahjongGame;
  claimTimer?: ReturnType<typeof setTimeout>;
  /** Seats with a bot move currently scheduled (setTimeout pending), to avoid double-scheduling. */
  botTimerSeats: Set<number> = new Set();
  /** Set once the room is garbage-collected, so any already-scheduled bot timers stop rescheduling themselves. */
  deleted = false;

  constructor(code: string, hostToken: string) {
    this.code = code;
    this.hostToken = hostToken;
  }

  get filledSeats(): number {
    return this.players.filter((p) => p !== null).length;
  }

  findByToken(token: string): RoomPlayer | undefined {
    return this.players.find((p) => p?.token === token) ?? undefined;
  }

  addPlayer(name: string, token: string): RoomPlayer {
    const seat = this.players.findIndex((p) => p === null);
    if (seat < 0) throw new Error("房間已滿");
    const player: RoomPlayer = { seat, token, name, socketId: null, connected: true, ready: false, isBot: false };
    this.players[seat] = player;
    return player;
  }

  /** Fills every empty seat with a computer-controlled bot. Returns the number of bots added. */
  fillWithBots(): number {
    let added = 0;
    for (let seat = 0; seat < 4; seat++) {
      if (this.players[seat] !== null) continue;
      const token = `bot-${botCounter++}-${Date.now()}`;
      this.players[seat] = {
        seat,
        token,
        name: `電腦${WIND_NAMES[seat + 1]}`,
        socketId: null,
        connected: true,
        ready: true,
        isBot: true,
      };
      added++;
    }
    return added;
  }

  buildView(requestingToken: string | null): GameStateView {
    const requester = requestingToken ? this.findByToken(requestingToken) : undefined;
    const mySeat = requester ? requester.seat : null;
    const hostSeat = this.findByToken(this.hostToken)?.seat ?? 0;

    if (!this.game) {
      const players: PublicPlayerView[] = this.players
        .filter((p): p is RoomPlayer => p !== null)
        .map((p) => ({
          seat: p.seat,
          name: p.name,
          connected: p.connected,
          ready: p.ready,
          handCount: 0,
          melds: [],
          flowers: [],
          isDealer: false,
          score: 0,
          isBot: p.isBot,
        }));
      return {
        roomCode: this.code,
        phase: "lobby",
        players,
        mySeat,
        myHand: [],
        wallRemaining: 0,
        discards: [],
        currentTurnSeat: null,
        dealerSeat: 0,
        roundWind: 1,
        handNumber: 0,
        myLegalActions: [],
        log: [],
        hostSeat,
      };
    }

    const game = this.game;
    const players: PublicPlayerView[] = game.players.map((gp) => {
      const rp = this.players[gp.seat];
      return {
        seat: gp.seat,
        name: gp.name,
        connected: rp?.connected ?? false,
        ready: true,
        handCount: gp.hand.length,
        melds: gp.melds,
        flowers: gp.flowers,
        isDealer: gp.seat === game.dealerSeat,
        score: gp.score,
        isBot: rp?.isBot ?? false,
      };
    });

    const lastEntry = game.discardPile[game.discardPile.length - 1];

    return {
      roomCode: this.code,
      phase: game.phase === "hand-end" ? "hand-end" : "playing",
      players,
      mySeat,
      myHand: mySeat !== null ? sortTiles(game.players[mySeat].hand) : [],
      wallRemaining: game.wall.remaining,
      discards: game.discardPile,
      currentTurnSeat: game.currentTurnSeat,
      dealerSeat: game.dealerSeat,
      roundWind: game.roundWind,
      handNumber: game.handNumber,
      myLegalActions: mySeat !== null ? game.getLegalActionsFor(mySeat) : [],
      lastDiscard: lastEntry ? { tile: lastEntry.tile, fromSeat: lastEntry.fromSeat } : undefined,
      claimDeadline: game.getClaimDeadline(),
      log: game.log,
      handResult: game.handResult,
      hostSeat,
    };
  }
}
