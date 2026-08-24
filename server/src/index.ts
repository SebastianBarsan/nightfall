import Fastify from "fastify";
import cors from "@fastify/cors";
import { Server } from "socket.io";
import {
  ClientToServerEvents,
  GamePhase,
  MAX_NAME_LENGTH,
  MAX_PLAYERS,
  MIN_NAME_LENGTH,
  ServerToClientEvents,
} from "@nightfall/shared";
import {
  createRoom,
  findRoomBySocket,
  getRoom,
  seatIndexOf,
  ServerRoom,
} from "./roomStore.js";
import {
  broadcastState,
  cleanupEmptyRoom,
  handleChat,
  handleHunterTarget,
  handleRobberTarget,
  handleSeerTarget,
  handleTroublemakerSwap,
  handleVoteCast,
  handleWerewolfViewCenter,
  resetForPlayAgain,
  startGame,
} from "./gameEngine.js";

const PORT = Number(process.env.PORT ?? 3001);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? "http://localhost:5173";

const app = Fastify();
await app.register(cors, { origin: CLIENT_ORIGIN });

app.get("/health", async () => ({ ok: true }));

await app.listen({ port: PORT, host: "0.0.0.0" });

const io = new Server<ClientToServerEvents, ServerToClientEvents>(app.server, {
  cors: { origin: CLIENT_ORIGIN },
});

function validName(name: string): string | null {
  const trimmed = name.trim().slice(0, MAX_NAME_LENGTH);
  if (trimmed.length < MIN_NAME_LENGTH) return null;
  return trimmed;
}

io.on("connection", (socket) => {
  socket.on("room:create", ({ name }, cb) => {
    const cleanName = validName(name);
    if (!cleanName) return cb({ ok: false, error: "Enter a valid name." });
    const room = createRoom(socket.id, cleanName);
    socket.join(room.code);
    cb({ ok: true, code: room.code });
    broadcastState(io, room);
  });

  socket.on("room:join", ({ code, name }, cb) => {
    const cleanName = validName(name);
    if (!cleanName) return cb({ ok: false, error: "Enter a valid name." });
    const room = getRoom(code);
    if (!room) return cb({ ok: false, error: "Room not found." });
    if (room.phase !== GamePhase.LOBBY) return cb({ ok: false, error: "Game already in progress." });
    if (room.seats.length >= MAX_PLAYERS) return cb({ ok: false, error: "Room is full." });
    room.seats.push({ socketId: socket.id, name: cleanName, connected: true });
    socket.join(room.code);
    cb({ ok: true });
    broadcastState(io, room);
  });

  socket.on("room:start", () => {
    const room = findRoomBySocket(socket.id);
    if (!room) return;
    startGame(io, room, socket.id);
  });

  socket.on("room:playAgain", () => {
    const room = findRoomBySocket(socket.id);
    if (!room) return;
    resetForPlayAgain(io, room, socket.id);
  });

  socket.on("night:werewolf:viewCenter", ({ centerIndex }) => {
    const room = findRoomBySocket(socket.id);
    if (room) handleWerewolfViewCenter(io, room, socket.id, centerIndex);
  });

  socket.on("night:seer:target", ({ playerSeat, centerIndices }) => {
    const room = findRoomBySocket(socket.id);
    if (room) handleSeerTarget(io, room, socket.id, playerSeat, centerIndices);
  });

  socket.on("night:robber:target", ({ playerSeat }) => {
    const room = findRoomBySocket(socket.id);
    if (room) handleRobberTarget(io, room, socket.id, playerSeat);
  });

  socket.on("night:troublemaker:swap", ({ seatA, seatB }) => {
    const room = findRoomBySocket(socket.id);
    if (room) handleTroublemakerSwap(io, room, socket.id, seatA, seatB);
  });

  socket.on("coin:tap", () => {
    // Purely cosmetic ack for the dummy-traffic obfuscation pattern; no game effect.
  });

  socket.on("day:chat", ({ text }) => {
    const room = findRoomBySocket(socket.id);
    if (room) handleChat(io, room, socket.id, text);
  });

  socket.on("vote:cast", ({ targetSocketId }) => {
    const room = findRoomBySocket(socket.id);
    if (room) handleVoteCast(io, room, socket.id, targetSocketId);
  });

  socket.on("hunter:target", ({ targetSocketId }) => {
    const room = findRoomBySocket(socket.id);
    if (room) handleHunterTarget(io, room, socket.id, targetSocketId);
  });

  socket.on("disconnect", () => {
    const room = findRoomBySocket(socket.id);
    if (!room) return;
    handleDisconnect(room, socket.id);
  });
});

function handleDisconnect(room: ServerRoom, socketId: string): void {
  const seat = seatIndexOf(room, socketId);
  if (seat === -1) return;

  if (room.phase === GamePhase.LOBBY) {
    room.seats.splice(seat, 1);
    if (room.hostSocketId === socketId && room.seats.length > 0) {
      room.hostSocketId = room.seats[0].socketId;
    }
  } else {
    room.seats[seat].connected = false;
  }

  cleanupEmptyRoom(room);
  if (room.seats.length > 0) broadcastState(io, room);
}

// eslint-disable-next-line no-console
console.log(`Nightfall server listening on :${PORT}`);
