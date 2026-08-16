import { Server, Socket } from "socket.io";
import { ClientAction } from "@mahjong/shared";
import { RoomManager } from "../room/RoomManager";
import { MahjongGame } from "../game/MahjongGame";
import { Room } from "../room/Room";
import { chooseBotAction } from "../game/Bot";

interface SocketData {
  roomCode?: string;
  token?: string;
}

interface Ack {
  (res: { ok: true } | { ok: false; message: string }): void;
}

const BOT_MIN_DELAY_MS = 800;
const BOT_MAX_DELAY_MS = 1700;

export function registerSocketHandlers(io: Server, roomManager: RoomManager) {
  const socketIndex = new Map<string, SocketData>();

  function broadcastRoom(room: Room) {
    for (const player of room.players) {
      if (!player || !player.connected || !player.socketId) continue;
      io.to(player.socketId).emit("game:state", room.buildView(player.token));
    }
  }

  /** After any state change: push the update to connected humans, then let any bots react. */
  function afterStateChange(room: Room) {
    broadcastRoom(room);
    scheduleBotTurnsIfNeeded(room);
  }

  /**
   * Schedules a delayed automatic move for every bot seat that currently has a pending
   * decision (their turn to discard, or a chi/pon/kong/hu response during a claim window).
   * Safe to call repeatedly - seats with a move already scheduled, or with nothing to do,
   * are skipped.
   */
  function scheduleBotTurnsIfNeeded(room: Room) {
    if (room.deleted) return;
    const game = room.game;
    if (!game || game.phase !== "playing") return;

    for (let seat = 0; seat < 4; seat++) {
      const rp = room.players[seat];
      if (!rp || !rp.isBot) continue;
      if (room.botTimerSeats.has(seat)) continue;
      if (game.getLegalActionsFor(seat).length === 0) continue;

      room.botTimerSeats.add(seat);
      const delay = BOT_MIN_DELAY_MS + Math.random() * (BOT_MAX_DELAY_MS - BOT_MIN_DELAY_MS);
      setTimeout(() => {
        room.botTimerSeats.delete(seat);
        if (room.deleted || room.game !== game || game.getLegalActionsFor(seat).length === 0) return;
        try {
          game.handleAction(seat, chooseBotAction(game, seat));
        } catch {
          // The decision may have gone stale (e.g. a human already resolved this claim
          // window) between scheduling and firing - just skip this bot's move.
        }
        afterStateChange(room);
      }, delay);
    }
  }

  function armClaimTimer(room: Room, ms: number) {
    if (room.claimTimer) clearTimeout(room.claimTimer);
    room.claimTimer = setTimeout(() => {
      if (room.deleted || !room.game) return;
      room.game.forceResolveClaims();
      afterStateChange(room);
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
        } else if (action.type === "fill-bots") {
          if (process.env.ALLOW_BOTS === "false") throw new Error("此伺服器僅供真人四人連線，未開放電腦補位");
          if (room.game) throw new Error("遊戲已開始");
          const added = room.fillWithBots();
          if (added === 0) throw new Error("已經沒有空位了");
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
        afterStateChange(room);
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
