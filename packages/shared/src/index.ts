// NOTE: deliberately using explicit named re-exports (not `export *`) here.
// TS compiles `export *` to a dynamic __exportStar/for-in helper that Rollup's
// CommonJS interop cannot statically analyze, which breaks named imports
// (e.g. `import { tileGlyph } from "@mahjong/shared"`) in the client's production build.

export type { Suit, Tile } from "./tiles";
export {
  WIND_NAMES,
  DRAGON_NAMES,
  FLOWER_NAMES,
  SUIT_NUM_NAMES,
  tileLabel,
  tileGlyph,
  tileKey,
  isSameTileType,
  isFlower,
  isHonor,
  isNumbered,
  flowerOwnerSeat,
  buildFullTileSet,
  sortTiles,
} from "./tiles";

export type {
  MeldType,
  Meld,
  DiscardEntry,
  PublicPlayerView,
  LegalAction,
  HandResultWinner,
  HandResult,
  Phase,
  GameStateView,
  ClientAction,
  CreateRoomRequest,
  CreateRoomResponse,
  JoinRoomRequest,
  JoinRoomResponse,
  JoinRoomError,
} from "./protocol";
