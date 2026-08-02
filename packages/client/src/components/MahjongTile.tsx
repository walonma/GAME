import { Tile, tileGlyph, tileLabel } from "@mahjong/shared";

interface Props {
  tile: Tile;
  onClick?: () => void;
  selected?: boolean;
  small?: boolean;
  faceDown?: boolean;
}

const suitClass: Record<string, string> = {
  man: "suit-man",
  pin: "suit-pin",
  sou: "suit-sou",
  wind: "suit-honor",
  dragon: "suit-honor",
  flower: "suit-flower",
};

export function MahjongTile({ tile, onClick, selected, small, faceDown }: Props) {
  if (faceDown) {
    return <div className={`tile tile-back ${small ? "tile-small" : ""}`} />;
  }
  return (
    <button
      type="button"
      className={`tile ${suitClass[tile.suit]} ${selected ? "tile-selected" : ""} ${small ? "tile-small" : ""} ${
        onClick ? "tile-clickable" : ""
      }`}
      onClick={onClick}
      disabled={!onClick}
    >
      <span className="tile-glyph">{tileGlyph(tile)}</span>
      <span className="tile-label">{tileLabel(tile)}</span>
    </button>
  );
}
