export interface SavedSession {
  roomCode: string;
  playerToken: string;
  name: string;
}

const KEY = "mahjong-session";

export function loadSession(): SavedSession | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveSession(session: SavedSession) {
  localStorage.setItem(KEY, JSON.stringify(session));
}

export function clearSession() {
  localStorage.removeItem(KEY);
}

export function loadName(): string {
  return localStorage.getItem("mahjong-name") ?? "";
}

export function saveName(name: string) {
  localStorage.setItem("mahjong-name", name);
}
