import { Tile } from "@mahjong/shared";
import { PinPips, SouBamboo, FlowerIcon } from "./TileArt";

interface Props {
  tile: Tile;
  onClick?: () => void;
  selected?: boolean;
  small?: boolean;
  faceDown?: boolean;
}

// Traditional-tile-styled faces. Text (numerals/characters) uses plain CJK glyphs via CSS
// fonts (always renders, including on Android); pip patterns (筒/索) are procedural SVG
// (see TileArt.tsx) rather than the Unicode "Mahjong Tiles" block, which is unreliably
// supported by Android's system/emoji fonts.

const CHINESE_NUMERALS = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
const WIND_NAMES: Record<number, string> = { 1: "東", 2: "南", 3: "西", 4: "北" };
const DRAGON_NAMES: Record<number, string> = { 1: "中", 2: "發", 3: "白" };
const FLOWER_NAMES: Record<number, string> = { 1: "梅", 2: "蘭", 3: "竹", 4: "菊", 5: "春", 6: "夏", 7: "秋", 8: "冬" };

function TileFace({ tile }: { tile: Tile }) {
  switch (tile.suit) {
    case "man":
      return (
        <span className="tile-man">
          <span className="tile-man-num">{CHINESE_NUMERALS[tile.value]}</span>
          <span className="tile-man-suit">萬</span>
        </span>
      );
    case "pin":
      return <PinPips count={tile.value} />;
    case "sou":
      return <SouBamboo count={tile.value} />;
    case "wind":
      return <span className="tile-honor tile-wind">{WIND_NAMES[tile.value]}</span>;
    case "dragon":
      if (tile.value === 3) return <span className="tile-blank-frame" />;
      return (
        <span className={`tile-honor ${tile.value === 1 ? "tile-dragon-red" : "tile-dragon-green"}`}>
          {DRAGON_NAMES[tile.value]}
        </span>
      );
    case "flower":
      return (
        <span className="tile-flower">
          <FlowerIcon season={tile.value > 4} />
          <span className="tile-flower-label">{FLOWER_NAMES[tile.value]}</span>
        </span>
      );
  }
}

export function MahjongTile({ tile, onClick, selected, small, faceDown }: Props) {
  if (faceDown) {
    return <div className={`tile tile-back ${small ? "tile-small" : ""}`} />;
  }
  return (
    <button
      type="button"
      className={`tile ${selected ? "tile-selected" : ""} ${small ? "tile-small" : ""} ${onClick ? "tile-clickable" : ""}`}
      onClick={onClick}
      disabled={!onClick}
    >
      <TileFace tile={tile} />
    </button>
  );
}
