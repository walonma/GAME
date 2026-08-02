import { Server, Socket } from "socket.io";
import { ClientAction } from "@mahjong/shared";
import { RoomManager } from "../room/RoomManager";
import { MahjongGame } from "../game/MahjongGame";
import { Room } from "../room/Room";

interface SocketData {
  roomCode?: string;
  token?: string;
}

interface Ack {
  (res: { ok: true } | { ok: false; message: string }): void;
}

export function registerSocketHandlers(io: Server, roomManager: RoomManager) {
  const socketIndex = new Map<string, SocketData>();

  function broadcastRoom(room: Room) {
    for (const player of room.players) {
      if (!player || !player.connected || !player.socketId) continue;
      io.to(player.socketId).emit("game:state", room.buildView(player.token));
    }
  }

  function armClaimTimer(room: Room, ms: number) {
    if (room.claimTimer) clearTimeout(room.claimTimer);
    room.claimTimer = setTimeout(() => {
      if (!room.game) return;
      room.game.forceResolveClaims();
      broadcastRoom(room);
    }, ms + 300); // small grace period beyond the client-visible deadline
  }

  function attachGame(room: Room) {
    room.game!.setClaimWindowCallback((ms) => armClaimTimer(room, ms));
  }

  io.on("connection", (socket: Socket) => {
    socketIndex.set(socket.id, {});

    socket.on("room:create", (payload: { name: string }, ack: Ack & ((res: any) => void)) => {
      try {
        const { room, player } = roomManager.createRoom(payload?.name ?? "");
        player.socketId = socket.id;
        socket.join(room.code);
        socketIndex.set(socket.id, { roomCode: room.code, token: player.token });
        ack({ ok: true, roomCode: room.code, playerToken: player.token } as any);
        broadcastRoom(room);
      } catch (err: any) {
        ack({ ok: false, message: err.message ?? "無法建立房間" });
      }
    });

    socket.on(
      "room:join",
      (payload: { roomCode: string; name: string; playerToken?: string }, ack: (res: any) => void) => {
        try {
          const { room, player } = roomManager.joinRoom(payload.roomCode, payload.name, payload.playerToken);
          player.socketId = socket.id;
          player.connected = true;
          socket.join(room.code);
          socketIndex.set(socket.id, { roomCode: room.code, token: player.token });
          ack({ ok: true, playerToken: player.token });
          broadcastRoom(room);
        } catch (err: any) {
          ack({ ok: false, message: err.message ?? "無法加入房間" });
        }
      }
    );

    socket.on("action", (action: ClientAction, ack?: (res: any) => void) => {
      const data = socketIndex.get(socket.id);
      const respond = ack ?? (() => {});
      if (!data?.roomCode || !data?.token) return respond({ ok: false, message: "尚未加入房間" });
      const room = roomManager.getRoom(data.roomCode);
      if (!room) return respond({ ok: false, message: "房間不存在" });
      const player = room.findByToken(data.token);
      if (!player) return respond({ ok: false, message: "找不到玩家" });

      try {
        if (action.type === "ready") {
          if (room.game) throw new Error("遊戲已開始");
          player.ready = action.ready;
        } else if (action.type === "start") {
          if (room.game) throw new Error("遊戲已開始");
          if (room.filledSeats !== 4) throw new Error("需要滿四人才能開始");
          if (room.players.some((p) => p && !p.ready)) throw new Error("還有玩家尚未準備");
          const names = room.players.map((p) => p!.name) as [string, string, string, string];
          room.game = new MahjongGame(names);
          attachGame(room);
          room.game.startHand({ dealerSeat: 0, roundWind: 1, handNumber: 1 });
        } else if (action.type === "next-hand") {
          if (!room.game) throw new Error("遊戲尚未開始");
          if (room.game.phase !== "hand-end") throw new Error("目前不是可以開始下一局的時機");
          room.game.advanceToNextHand();
        } else {
          if (!room.game) throw new Error("遊戲尚未開始");
          room.game.handleAction(player.seat, action);
        }
        respond({ ok: true });
        broadcastRoom(room);
      } catch (err: any) {
        respond({ ok: false, message: err.message ?? "動作失敗" });
      }
    });

    socket.on("disconnect", () => {
      const data = socketIndex.get(socket.id);
      socketIndex.delete(socket.id);
      if (!data?.roomCode || !data?.token) return;
      const room = roomManager.getRoom(data.roomCode);
      if (!room) return;
      const player = room.findByToken(data.token);
      if (!player) return;
      player.connected = false;
      player.socketId = null;
      broadcastRoom(room);
      roomManager.removeEmptyRoomIfNeeded(room.code);
    });
  });
}
