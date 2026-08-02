// Taiwan Mahjong (16-tile) tile model.
// 144 tiles total: 3 suits x 9 ranks x 4 copies (108) + 4 winds x4 (16)
// + 3 dragons x4 (12) + 8 flowers x1 (8) = 144.

export type Suit = "man" | "pin" | "sou" | "wind" | "dragon" | "flower";

// man/pin/sou: value 1-9
// wind: 1=East 2=South 3=West 4=North
// dragon: 1=Red(中) 2=Green(發) 3=White(白)
// flower: 1-4 = plants (梅蘭竹菊, seat East/South/West/North), 5-8 = seasons (春夏秋冬, seat East/South/West/North)
export interface Tile {
  /** Unique instance id, stable for the lifetime of a game. Used as React key / tracking. */
  id: string;
  suit: Suit;
  value: number;
}

export const WIND_NAMES = ["", "東", "南", "西", "北"];
export const DRAGON_NAMES = ["", "中", "發", "白"];
export const FLOWER_NAMES = ["", "梅", "蘭", "竹", "菊", "春", "夏", "秋", "冬"];
export const SUIT_NUM_NAMES: Record<string, string> = { man: "萬", pin: "筒", sou: "條" };

export function tileLabel(t: Pick<Tile, "suit" | "value">): string {
  switch (t.suit) {
    case "man":
    case "pin":
    case "sou":
      return `${t.value}${SUIT_NUM_NAMES[t.suit]}`;
    case "wind":
      return WIND_NAMES[t.value];
    case "dragon":
      return DRAGON_NAMES[t.value];
    case "flower":
      return FLOWER_NAMES[t.value];
  }
}

/** Unicode Mahjong Tiles block code point for a tile (used for client rendering). */
export function tileGlyph(t: Pick<Tile, "suit" | "value">): string {
  const cp = (n: number) => String.fromCodePoint(n);
  switch (t.suit) {
    case "wind":
      return cp(0x1f000 + (t.value - 1)); // East..North
    case "dragon": {
      // Unicode order: Red(中)=1F004, Green(發)=1F005, White(白)=1F006
      return cp(0x1f004 + (t.value - 1));
    }
    case "man":
      return cp(0x1f007 + (t.value - 1));
    case "sou":
      return cp(0x1f010 + (t.value - 1));
    case "pin":
      return cp(0x1f019 + (t.value - 1));
    case "flower":
      return cp(0x1f022 + (t.value - 1));
  }
}

/** Canonical (suit,value) key ignoring instance id -- used for comparing/grouping tiles. */
export function tileKey(t: Pick<Tile, "suit" | "value">): string {
  return `${t.suit}${t.value}`;
}

export function isSameTileType(a: Pick<Tile, "suit" | "value">, b: Pick<Tile, "suit" | "value">): boolean {
  return a.suit === b.suit && a.value === b.value;
}

export function isFlower(t: Pick<Tile, "suit" | "value">): boolean {
  return t.suit === "flower";
}

export function isHonor(t: Pick<Tile, "suit" | "value">): boolean {
  return t.suit === "wind" || t.suit === "dragon";
}

export function isNumbered(t: Pick<Tile, "suit" | "value">): boolean {
  return t.suit === "man" || t.suit === "pin" || t.suit === "sou";
}

/** Which seat (0=East,1=South,2=West,3=North) a flower tile "belongs" to. */
export function flowerOwnerSeat(t: Pick<Tile, "suit" | "value">): number {
  if (t.suit !== "flower") return -1;
  return t.value <= 4 ? t.value - 1 : t.value - 5;
}

/** Build the full 144-tile set (unshuffled), each with a unique id. */
export function buildFullTileSet(): Tile[] {
  const tiles: Tile[] = [];
  let counter = 0;
  const push = (suit: Suit, value: number, copies: number) => {
    for (let i = 0; i < copies; i++) {
      tiles.push({ id: `t${counter++}`, suit, value });
    }
  };
  for (const suit of ["man", "pin", "sou"] as const) {
    for (let v = 1; v <= 9; v++) push(suit, v, 4);
  }
  for (let v = 1; v <= 4; v++) push("wind", v, 4);
  for (let v = 1; v <= 3; v++) push("dragon", v, 4);
  for (let v = 1; v <= 8; v++) push("flower", v, 1);
  return tiles;
}

export function sortTiles(tiles: Tile[]): Tile[] {
  const suitOrder: Record<Suit, number> = { man: 0, pin: 1, sou: 2, wind: 3, dragon: 4, flower: 5 };
  return [...tiles].sort((a, b) => {
    if (a.suit !== b.suit) return suitOrder[a.suit] - suitOrder[b.suit];
    return a.value - b.value;
  });
}
