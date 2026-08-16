// Baked in at build time (Vite only exposes VITE_-prefixed env vars). This lets the same
// codebase be deployed as two distinct builds/URLs - a bots-disabled "four players only"
// version and a bots-enabled "2-4 players" version - by setting VITE_ALLOW_BOTS per deploy,
// without needing a second git branch.
const envValue = (import.meta as any).env?.VITE_ALLOW_BOTS as string | undefined;

export const ALLOW_BOTS = envValue !== "false";

export const GAME_MODE_LABEL = ALLOW_BOTS ? "2～4 人版（人數不夠可找電腦補位）" : "四人連線版";
