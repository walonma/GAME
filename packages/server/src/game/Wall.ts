import { Tile, buildFullTileSet } from "@mahjong/shared";

/** Fisher-Yates shuffle. */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * The live wall. Tiles are drawn from the front for normal turns.
 * Kong/flower replacement tiles are drawn from the back (the "dead wall" convention),
 * which also naturally shortens the live wall so the game still ends in time.
 */
export class Wall {
  private tiles: Tile[];

  /** Pass `presetTiles` (unshuffled, front of wall = index 0) to get a deterministic wall for tests. */
  constructor(presetTiles?: Tile[]) {
    this.tiles = presetTiles ? [...presetTiles] : shuffle(buildFullTileSet());
  }

  get remaining(): number {
    return this.tiles.length;
  }

  drawFromFront(): Tile | null {
    return this.tiles.shift() ?? null;
  }

  drawReplacement(): Tile | null {
    return this.tiles.pop() ?? null;
  }

  isEmpty(): boolean {
    return this.tiles.length === 0;
  }
}
