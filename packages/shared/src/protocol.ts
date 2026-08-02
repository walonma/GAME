import { Tile } from "./tiles";

export type MeldType = "chi" | "pon" | "kong-concealed" | "kong-exposed" | "kong-added";

export interface Meld {
  type: MeldType;
  tiles: Tile[];
  /** Seat the called tile was taken from (undefined for concealed kong). */
  fromSeat?: number;
  /** id of the tile that was claimed from a discard / robbed, if any. */
  calledTileId?: string;
}

export interface DiscardEntry {
  tile: Tile;
  fromSeat: number;
  /** Set once another player claims this discard (chi/pon/kong/hu). */
  claimedBySeat?: number;
}

export interface PublicPlayerView {
  seat: number;
  name: string;
  connected: boolean;
  ready: boolean;
  handCount: number;
  melds: Meld[];
  flowers: Tile[];
  isDealer: boolean;
  score: number;
}

export type LegalAction =
  | { type: "discard" }
  | { type: "hu"; kind: "self" | "discard" }
  | { type: "kong"; kind: "concealed" | "added" | "exposed"; groups: string[][] } // arrays of tile ids that can form the kong
  | { type: "pon"; groups: string[][] }
  | { type: "chi"; groups: string[][] } // each group = 2 tile ids from hand to combine with the discard
  | { type: "pass" };

export interface HandResultWinner {
  seat: number;
  taiCount: number;
  taiBreakdown: { name: string; tai: number }[];
  points: number;
  winTile: Tile;
  selfDrawn: boolean;
}

export interface HandResult {
  winners: HandResultWinner[];
  loserSeat?: number; // discarder who fed the winning tile (if not self-drawn)
  drawGame: boolean; // wall exhausted, no winner
  pointsDelta: number[]; // per seat, applied this hand
  dealerContinues: boolean;
}

export type Phase = "lobby" | "playing" | "hand-end" | "game-end";

export interface GameStateView {
  roomCode: string;
  phase: Phase;
  players: PublicPlayerView[];
  mySeat: number | null;
  myHand: Tile[];
  wallRemaining: number;
  discards: DiscardEntry[];
  currentTurnSeat: number | null;
  dealerSeat: number;
  roundWind: number; // 1 = East round
  handNumber: number;
  myLegalActions: LegalAction[];
  lastDiscard?: { tile: Tile; fromSeat: number };
  claimDeadline?: number; // epoch ms
  log: string[];
  handResult?: HandResult;
  hostSeat: number;
}

// ---- Client -> Server actions ----

export type ClientAction =
  | { type: "ready"; ready: boolean }
  | { type: "start" }
  | { type: "discard"; tileId: string }
  | { type: "kong"; tileIds: string[] }
  | { type: "hu" }
  | { type: "pon"; tileIds: string[] }
  | { type: "chi"; tileIds: string[] }
  | { type: "pass" }
  | { type: "next-hand" };

export interface CreateRoomRequest {
  name: string;
}
export interface CreateRoomResponse {
  roomCode: string;
  playerToken: string;
}

export interface JoinRoomRequest {
  roomCode: string;
  name: string;
  playerToken?: string;
}
export interface JoinRoomResponse {
  ok: true;
  playerToken: string;
}
export interface JoinRoomError {
  ok: false;
  message: string;
}
