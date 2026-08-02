import { GameStateView } from "@mahjong/shared";
import { MahjongTile } from "./MahjongTile";
import { socket } from "../socket";

interface Props {
  view: GameStateView;
}

export function HandResultModal({ view }: Props) {
  const result = view.handResult;
  if (!result) return null;

  function nameOf(seat: number) {
    return view.players.find((p) => p.seat === seat)?.name ?? `座位 ${seat}`;
  }

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        {result.drawGame ? (
          <h2>流局</h2>
        ) : (
          <>
            <h2>
              {result.winners.map((w) => nameOf(w.seat)).join("、")} 胡牌！
              {result.loserSeat !== undefined && <> （由 {nameOf(result.loserSeat)} 放槍）</>}
            </h2>
            {result.winners.map((w) => (
              <div key={w.seat} className="winner-block">
                <div className="winner-title">
                  {nameOf(w.seat)} · {w.taiCount} 台 · {w.selfDrawn ? "自摸" : "胡牌"}
                </div>
                <div className="tai-list">
                  {w.taiBreakdown.map((e, i) => (
                    <span key={i} className="tai-chip">
                      {e.name} {e.tai}台
                    </span>
                  ))}
                </div>
                <div className="win-tile-row">
                  贏牌：<MahjongTile tile={w.winTile} small />
                </div>
              </div>
            ))}
          </>
        )}

        <div className="score-delta-row">
          {result.pointsDelta.map((d, seat) => (
            <div key={seat} className="score-delta">
              {nameOf(seat)}: <span className={d >= 0 ? "score-pos" : "score-neg"}>{d >= 0 ? `+${d}` : d}</span>
            </div>
          ))}
        </div>

        <button className="btn btn-primary" onClick={() => socket.emit("action", { type: "next-hand" })}>
          下一局
        </button>
      </div>
    </div>
  );
}
