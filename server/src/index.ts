import Fastify from "fastify";
import cors from "@fastify/cors";
import { Server } from "socket.io";
import {
  ClientToServerEvents,
  GamePhase,
  MAX_PLAYERS,
  ServerToClientEvents,
} from "@nightfall/shared";
import {
  createSession,
  destroySession,
  loginUser,
  registerUser,
  resumeSession,
  statsForUser,
} from "./auth.js";
import {
  createRoom,
  findRoomBySocket,
  getRoom,
  repairRoleCounts,
  seatIndexOf,
  ServerRoom,
} from "./roomStore.js";
import {
  broadcastState,
  cleanupEmptyRoom,
  configureRoles,
  handleChat,
  handleHunterTarget,
  handleInsomniacReveal,
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

interface SocketData {
  userId: number | null;
  username: string | null;
}

const io = new Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>(app.server, {
  cors: { origin: CLIENT_ORIGIN },
});

io.on("connection", (socket) => {
  socket.data.userId = null;
  socket.data.username = null;

  socket.on("auth:register", ({ username, password }, cb) => {
    const res = registerUser(username, password);
    if (!res.ok) return cb(res);
    const token = createSession(res.user);
    socket.data.userId = res.user.id;
    socket.data.username = res.user.username;
    cb({ ok: true, token, username: res.user.username, stats: statsForUser(res.user.id)! });
  });

  socket.on("auth:login", ({ username, password }, cb) => {
    const res = loginUser(username, password);
    if (!res.ok) return cb(res);
    const token = createSession(res.user);
    socket.data.userId = res.user.id;
    socket.data.username = res.user.username;
    cb({ ok: true, token, username: res.user.username, stats: statsForUser(res.user.id)! });
  });

  socket.on("auth:resume", ({ token }, cb) => {
    const user = resumeSession(token);
    if (!user) return cb({ ok: false, error: "Session expired. Please log in again." });
    socket.data.userId = user.id;
    socket.data.username = user.username;
    cb({ ok: true, token, username: user.username, stats: statsForUser(user.id)! });
  });

  socket.on("auth:logout", ({ token }) => {
    destroySession(token);
    socket.data.userId = null;
    socket.data.username = null;
  });

  socket.on("room:create", (cb) => {
    if (!socket.data.userId || !socket.data.username) return cb({ ok: false, error: "Please log in first." });
    const room = createRoom(socket.id, socket.data.username, socket.data.userId);
    socket.join(room.code);
    cb({ ok: true, code: room.code });
    broadcastState(io, room);
  });

  socket.on("room:join", ({ code }, cb) => {
    if (!socket.data.userId || !socket.data.username) return cb({ ok: false, error: "Please log in first." });
    const room = getRoom(code);
    if (!room) return cb({ ok: false, error: "Room not found." });
    if (room.phase !== GamePhase.LOBBY) return cb({ ok: false, error: "Game already in progress." });
    if (room.seats.length >= MAX_PLAYERS) return cb({ ok: false, error: "Room is full." });
    room.seats.push({ socketId: socket.id, userId: socket.data.userId, name: socket.data.username, connected: true });
    socket.join(room.code);
    repairRoleCounts(room);
    cb({ ok: true });
    broadcastState(io, room);
  });

  socket.on("room:start", () => {
    const room = findRoomBySocket(socket.id);
    if (!room) return;
    startGame(io, room, socket.id);
  });

  socket.on("room:configureRoles", ({ roleCounts }) => {
    const room = findRoomBySocket(socket.id);
    if (room) configureRoles(io, room, socket.id, roleCounts);
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

  socket.on("night:insomniac:reveal", () => {
    const room = findRoomBySocket(socket.id);
    if (room) handleInsomniacReveal(io, room, socket.id);
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
    repairRoleCounts(room);
  } else {
    room.seats[seat].connected = false;
    // Hand the host role to someone still here, or nobody can start the next round.
    if (room.hostSocketId === socketId) {
      const next = room.seats.find((s) => s.connected);
      if (next) room.hostSocketId = next.socketId;
    }
  }

  cleanupEmptyRoom(room);
  if (room.seats.length > 0) broadcastState(io, room);
}

// eslint-disable-next-line no-console
console.log(`Nightfall server listening on :${PORT}`);
