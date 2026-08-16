import { customAlphabet } from "nanoid";
import { Room, RoomPlayer } from "./Room";

// Avoid ambiguous characters (0/O, 1/I).
const roomCodeAlphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const generateRoomCode = customAlphabet(roomCodeAlphabet, 4);
const generateToken = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 24);

export class RoomManager {
  private rooms = new Map<string, Room>();

  createRoom(name: string): { room: Room; player: RoomPlayer } {
    let code = generateRoomCode();
    while (this.rooms.has(code)) code = generateRoomCode();
    const token = generateToken();
    const room = new Room(code, token);
    const player = room.addPlayer(name || "玩家", token);
    this.rooms.set(code, room);
    return { room, player };
  }

  getRoom(code: string): Room | undefined {
    return this.rooms.get(code.toUpperCase());
  }

  joinRoom(code: string, name: string, token?: string): { room: Room; player: RoomPlayer } {
    const room = this.getRoom(code);
    if (!room) throw new Error("找不到房間");

    if (token) {
      const existing = room.findByToken(token);
      if (existing) {
        existing.connected = true;
        if (name) existing.name = name;
        return { room, player: existing };
      }
    }

    if (room.filledSeats >= 4) throw new Error("房間已滿");
    if (room.game) throw new Error("遊戲已經開始，無法加入");
    const player = room.addPlayer(name || "玩家", generateToken());
    return { room, player };
  }

  removeEmptyRoomIfNeeded(code: string) {
    const room = this.rooms.get(code);
    if (!room) return;
    // Bots are always marked "connected" and never leave on their own, so only real
    // players count here - otherwise a room a human abandoned to bots would never be GC'd.
    const anyHumanConnected = room.players.some((p) => p && !p.isBot && p.connected);
    if (!anyHumanConnected) {
      if (room.claimTimer) clearTimeout(room.claimTimer);
      room.deleted = true;
      this.rooms.delete(code);
    }
  }
}
