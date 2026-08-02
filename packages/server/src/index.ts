import express from "express";
import http from "http";
import path from "path";
import cors from "cors";
import { Server } from "socket.io";
import { RoomManager } from "./room/RoomManager";
import { registerSocketHandlers } from "./socket";

const PORT = Number(process.env.PORT) || 4000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN; // e.g. http://localhost:5173, leave unset to allow all

const app = express();
app.use(cors({ origin: CLIENT_ORIGIN ?? true }));
app.get("/health", (_req, res) => res.json({ ok: true }));

// In production, serve the built client if it exists alongside the server.
const clientDist = path.resolve(__dirname, "../../client/dist");
app.use(express.static(clientDist));
app.get("*", (_req, res, next) => {
  res.sendFile(path.join(clientDist, "index.html"), (err) => {
    if (err) next();
  });
});

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: CLIENT_ORIGIN ?? true },
});

const roomManager = new RoomManager();
registerSocketHandlers(io, roomManager);

httpServer.listen(PORT, () => {
  console.log(`Mahjong server listening on port ${PORT}`);
});
