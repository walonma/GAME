import { Suit, Tile } from "@mahjong/shared";

let counter = 0;

export function t(suit: Suit, value: number): Tile {
  return { id: `test-${suit}-${value}-${counter++}`, suit, value };
}

/** Parse a shorthand like "1m2m3m5p5p" (m=man,p=pin,s=sou,w=wind,d=dragon,f=flower) into Tiles. */
export function hand(spec: string): Tile[] {
  const tiles: Tile[] = [];
  const suitMap: Record<string, Suit> = { m: "man", p: "pin", s: "sou", w: "wind", d: "dragon", f: "flower" };
  const cleaned = spec.replace(/\s/g, "");
  const re = /(\d)([mpswdf])/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(cleaned)) !== null) {
    tiles.push(t(suitMap[match[2]], Number(match[1])));
  }
  return tiles;
}
