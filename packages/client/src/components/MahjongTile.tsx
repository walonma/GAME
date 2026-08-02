import { Tile, tileLabel } from "@mahjong/shared";

// Tile faces are rendered as plain CJK text (never the Unicode "Mahjong Tiles" block,
// e.g. U+1F007). That block is unreliably supported by Android's system/emoji fonts and
// tends to render as blank "tofu" boxes on phones/tablets, even though it looks fine on
// desktop. Plain Han characters + digits render everywhere.

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
  const label = tileLabel(tile);
  const isNumbered = tile.suit === "man" || tile.suit === "pin" || tile.suit === "sou";
  // Numbered tiles ("8筒") get a big digit + small suit character underneath;
  // honors/flowers ("南", "白", "春") are a single character shown large.
  const digit = isNumbered ? label[0] : label;
  const suitChar = isNumbered ? label.slice(1) : null;

  return (
    <button
      type="button"
      className={`tile ${suitClass[tile.suit]} ${selected ? "tile-selected" : ""} ${small ? "tile-small" : ""} ${
        onClick ? "tile-clickable" : ""
      }`}
      onClick={onClick}
      disabled={!onClick}
    >
      <span className="tile-main">{digit}</span>
      {suitChar && <span className="tile-suit">{suitChar}</span>}
    </button>
  );
}
