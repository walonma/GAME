import { PublicPlayerView, Meld, DiscardEntry } from "@mahjong/shared";
import { MahjongTile } from "./MahjongTile";

interface Props {
  player: PublicPlayerView;
  isMe: boolean;
  isCurrentTurn: boolean;
  position: "top" | "bottom" | "left" | "right";
  discards: DiscardEntry[];
}

function MeldView({ meld }: { meld: Meld }) {
  return (
    <div className="meld">
      {meld.tiles.map((t) => (
        <MahjongTile key={t.id} tile={t} small />
      ))}
    </div>
  );
}

export function PlayerPanel({ player, isMe, isCurrentTurn, position, discards }: Props) {
  return (
    <div className={`player-panel panel-${position} ${isCurrentTurn ? "panel-active" : ""}`}>
      <div className="player-header">
        <span className={`conn-dot ${player.connected ? "conn-on" : "conn-off"}`} />
        <span className="player-name">
          {player.name}
          {isMe ? "（你）" : ""}
        </span>
        {player.isBot && <span className="bot-badge">電腦</span>}
        {player.isDealer && <span className="dealer-badge">莊</span>}
        <span className="player-score">{player.score}</span>
      </div>
      {player.flowers.length > 0 && (
        <div className="flower-row">
          {player.flowers.map((f) => (
            <MahjongTile key={f.id} tile={f} small />
          ))}
        </div>
      )}
      {player.melds.length > 0 && (
        <div className="meld-row">
          {player.melds.map((m, i) => (
            <MeldView key={i} meld={m} />
          ))}
        </div>
      )}
      {!isMe && <div className="hand-count">手牌 {player.handCount} 張</div>}
      {discards.length > 0 && (
        <div className="discard-row">
          {discards.map((d, i) => (
            <MahjongTile key={i} tile={d.tile} small />
          ))}
        </div>
      )}
    </div>
  );
}
