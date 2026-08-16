import { useState } from "react";
import { CreateRoomResponse, JoinRoomResponse } from "@mahjong/shared";
import { emitAck } from "../socket";
import { loadName, saveName, saveSession } from "../storage";
import { GAME_MODE_LABEL } from "../config";

interface Props {
  onJoined: () => void;
}

export function Home({ onJoined }: Props) {
  const [name, setName] = useState(loadName());
  const [roomCode, setRoomCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (!name.trim()) return setError("請先輸入你的名字");
    setBusy(true);
    setError(null);
    try {
      saveName(name.trim());
      const res = await emitAck<CreateRoomResponse & { ok: true }>("room:create", { name: name.trim() });
      saveSession({ roomCode: res.roomCode, playerToken: res.playerToken, name: name.trim() });
      onJoined();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin() {
    if (!name.trim()) return setError("請先輸入你的名字");
    if (!roomCode.trim()) return setError("請輸入房號");
    setBusy(true);
    setError(null);
    try {
      saveName(name.trim());
      const code = roomCode.trim().toUpperCase();
      const res = await emitAck<JoinRoomResponse & { ok: true }>("room:join", { roomCode: code, name: name.trim() });
      saveSession({ roomCode: code, playerToken: res.playerToken, name: name.trim() });
      onJoined();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="screen home-screen">
      <h1>台灣麻將連線</h1>
      <span className="mode-badge">{GAME_MODE_LABEL}</span>
      <p className="subtitle">邀請朋友，即時連線打十六張台灣麻將</p>

      <label className="field">
        <span>你的名字</span>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={12} placeholder="輸入暱稱" />
      </label>

      <div className="home-actions">
        <button className="btn btn-primary" onClick={handleCreate} disabled={busy}>
          建立新房間
        </button>

        <div className="join-row">
          <input
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            maxLength={4}
            placeholder="房號"
            className="room-code-input"
          />
          <button className="btn" onClick={handleJoin} disabled={busy}>
            加入房間
          </button>
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}
    </div>
  );
}
