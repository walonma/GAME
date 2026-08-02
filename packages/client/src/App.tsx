import { useEffect, useState, useCallback } from "react";
import { GameStateView, JoinRoomResponse } from "@mahjong/shared";
import { socket, emitAck } from "./socket";
import { loadSession, clearSession } from "./storage";
import { Home } from "./components/Home";
import { Lobby } from "./components/Lobby";
import { GameBoard } from "./components/GameBoard";

export default function App() {
  const [view, setView] = useState<GameStateView | null>(null);
  const [reconnecting, setReconnecting] = useState(false);

  const tryRestoreSession = useCallback(async () => {
    const session = loadSession();
    if (!session) return;
    setReconnecting(true);
    try {
      await emitAck<JoinRoomResponse & { ok: true }>("room:join", {
        roomCode: session.roomCode,
        name: session.name,
        playerToken: session.playerToken,
      });
    } catch {
      clearSession();
      setView(null);
    } finally {
      setReconnecting(false);
    }
  }, []);

  useEffect(() => {
    socket.on("game:state", setView);
    socket.on("connect", tryRestoreSession);
    tryRestoreSession();
    return () => {
      socket.off("game:state", setView);
      socket.off("connect", tryRestoreSession);
    };
  }, [tryRestoreSession]);

  function handleLeave() {
    setView(null);
  }

  if (reconnecting && !view) {
    return (
      <div className="screen">
        <p>連線中…</p>
      </div>
    );
  }

  if (!view) {
    return <Home onJoined={() => void 0} />;
  }

  if (view.phase === "lobby") {
    return <Lobby view={view} onLeave={handleLeave} />;
  }

  return <GameBoard view={view} onLeave={handleLeave} />;
}
