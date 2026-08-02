import { io, Socket } from "socket.io-client";

const envUrl = (import.meta as any).env?.VITE_SERVER_URL as string | undefined;
const SERVER_URL = envUrl || ((import.meta as any).env?.DEV ? "http://localhost:4000" : undefined);

export const socket: Socket = io(SERVER_URL, { autoConnect: true });

interface AckErr {
  ok: false;
  message: string;
}

export function emitAck<T extends { ok: true }>(event: string, payload: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    socket.emit(event, payload, (res: T | AckErr) => {
      if (!res) return reject(new Error("伺服器沒有回應"));
      if (res.ok === false) reject(new Error((res as AckErr).message || "操作失敗"));
      else resolve(res as T);
    });
  });
}
