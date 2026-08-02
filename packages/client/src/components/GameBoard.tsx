import { GameStateView } from "@mahjong/shared";
import { socket } from "../socket";
import { PlayerPanel } from "./PlayerPanel";
import { MahjongTile } from "./MahjongTile";
import { ActionBar } from "./ActionBar";
import { Countdown } from "./Countdown";
import { HandResultModal } from "./HandResultModal";
import { clearSession } from "../storage";

interface Props {
  view: GameStateView;
  onLeave: () => void;
}

const POSITIONS: ("bottom" | "right" | "top" | "left")[] = ["bottom", "right", "top", "left"];

export function GameBoard({ view, onLeave }: Props) {
  const mySeat = view.mySeat ?? 0;
  const canDiscard = view.myLegalActions.some((a) => a.type === "discard");

  function seatAt(offset: number) {
    return (mySeat + offset) % 4;
  }

  function discardsFor(seat: number) {
    return view.discards.filter((d) => d.fromSeat === seat);
  }

  function discard(tileId: string) {
    if (!canDiscard) return;
    socket.emit("action", { type: "discard", tileId });
  }

  function leave() {
    clearSession();
    onLeave();
  }

  return (
    <div className="screen game-screen">
      <div className="game-topbar">
        <span>房間 {view.roomCode}</span>
        <span>牌堆剩餘 {view.wallRemaining}</span>
        <button className="btn btn-link" onClick={leave}>
          離開
        </button>
      </div>

      <div className="table-grid">
        {POSITIONS.map((pos, offset) => {
          const seat = seatAt(offset);
          const player = view.players.find((p) => p.seat === seat);
          if (!player) return <div key={pos} className={`zone-${pos}`} />;
          if (offset === 0) return null; // rendered separately below as "me"
          return (
            <div key={pos} className={`zone-${pos}`}>
              <PlayerPanel
                player={player}
                isMe={false}
                isCurrentTurn={view.currentTurnSeat === seat}
                position={pos}
                discards={discardsFor(seat)}
              />
            </div>
          );
        })}

        <div className="zone-center">
          {view.currentTurnSeat !== null && (
            <div className="turn-indicator">
              {view.claimDeadline
                ? "等待其他玩家回應（吃/碰/槓/胡）…"
                : `輪到 ${view.players.find((p) => p.seat === view.currentTurnSeat)?.name} 行動`}
              <Countdown deadline={view.claimDeadline} />
            </div>
          )}
          {view.lastDiscard && (
            <div className="last-discard">
              <span>最新棄牌</span>
              <MahjongTile tile={view.lastDiscard.tile} />
            </div>
          )}
        </div>
      </div>

      <div className="me-panel">
        <PlayerPanel
          player={view.players.find((p) => p.seat === mySeat)!}
          isMe
          isCurrentTurn={view.currentTurnSeat === mySeat}
          position="bottom"
          discards={discardsFor(mySeat)}
        />
        <div className="my-hand">
          {view.myHand.map((tile) => (
            <MahjongTile key={tile.id} tile={tile} onClick={canDiscard ? () => discard(tile.id) : undefined} />
          ))}
        </div>
        <ActionBar actions={view.myLegalActions} myHand={view.myHand} />
      </div>

      <div className="log-panel">
        {view.log
          .slice(-6)
          .reverse()
          .map((line, i) => (
            <div key={i} className="log-line">
              {line}
            </div>
          ))}
      </div>

      {view.phase === "hand-end" && <HandResultModal view={view} />}
    </div>
  );
}
