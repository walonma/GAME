import { GameStateView } from "@mahjong/shared";
import { socket } from "../socket";
import { clearSession } from "../storage";

interface Props {
  view: GameStateView;
  onLeave: () => void;
}

const SEAT_LABELS = ["東", "南", "西", "北"];

export function Lobby({ view, onLeave }: Props) {
  const me = view.players.find((p) => p.seat === view.mySeat);
  const allFull = view.players.length === 4;
  const allReady = allFull && view.players.every((p) => p.ready);
  const isHost = view.mySeat === view.hostSeat;

  function toggleReady() {
    socket.emit("action", { type: "ready", ready: !me?.ready });
  }

  function start() {
    socket.emit("action", { type: "start" });
  }

  function fillBots() {
    socket.emit("action", { type: "fill-bots" });
  }

  function leave() {
    clearSession();
    onLeave();
  }

  function copyCode() {
    navigator.clipboard?.writeText(view.roomCode).catch(() => {});
  }

  return (
    <div className="screen lobby-screen">
      <h1>房間 {view.roomCode}</h1>
      <button className="btn btn-link" onClick={copyCode}>
        複製房號分享給朋友
      </button>

      <div className="seat-grid">
        {[0, 1, 2, 3].map((seat) => {
          const p = view.players.find((pl) => pl.seat === seat);
          return (
            <div key={seat} className={`seat-card ${p ? "" : "seat-empty"} ${seat === view.mySeat ? "seat-mine" : ""}`}>
              <div className="seat-wind">{SEAT_LABELS[seat]}</div>
              {p ? (
                <>
                  <div className="seat-name">
                    {p.name}
                    {seat === view.hostSeat && <span className="host-badge">房主</span>}
                    {p.isBot && <span className="bot-badge">電腦</span>}
                  </div>
                  <div className={`seat-status ${p.ready ? "status-ready" : ""}`}>
                    {p.isBot ? "已準備" : p.connected ? (p.ready ? "已準備" : "尚未準備") : "已離線"}
                  </div>
                </>
              ) : (
                <div className="seat-status">等待玩家加入…</div>
              )}
            </div>
          );
        })}
      </div>

      <div className="lobby-actions">
        <button className="btn" onClick={toggleReady} disabled={!me}>
          {me?.ready ? "取消準備" : "我準備好了"}
        </button>
        {!allFull && (
          <button className="btn" onClick={fillBots}>
            找電腦補位
          </button>
        )}
        {isHost && (
          <button className="btn btn-primary" onClick={start} disabled={!allReady}>
            開始遊戲
          </button>
        )}
        <button className="btn btn-link" onClick={leave}>
          離開房間
        </button>
      </div>
      {!allFull && <p className="hint-text">需要滿四位玩家才能開始，人數不夠可以找電腦補位（例如兩人對戰兩台電腦）</p>}
    </div>
  );
}
