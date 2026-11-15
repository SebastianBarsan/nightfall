import Fastify from "fastify";
import cors from "@fastify/cors";
import { Server } from "socket.io";
import {
  ClientToServerEvents,
  GamePhase,
  MAX_PLAYERS,
  RoleCounts,
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

// Clients can send anything, so every payload is checked here before it reaches game logic.
type Payload = Record<string, unknown>;
type Ack = (res: unknown) => void;

function payloadOf(raw: unknown): Payload {
  return raw !== null && typeof raw === "object" ? (raw as Payload) : {};
}

function ackOf(raw: unknown): Ack {
  return typeof raw === "function" ? (raw as Ack) : () => {};
}

function isString(v: unknown): v is string {
  return typeof v === "string";
}

function isInt(v: unknown): v is number {
  return Number.isInteger(v);
}

// One bad event must never take down the whole server, so any throw or rejection is logged and dropped.
function guard<A extends unknown[]>(event: string, handler: (...args: A) => unknown) {
  return (...args: A) => {
    try {
      const result = handler(...args);
      if (result instanceof Promise) {
        result.catch((err) => console.error(`${event} handler failed:`, err));
      }
    } catch (err) {
      console.error(`${event} handler failed:`, err);
    }
  };
}

const io = new Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>(app.server, {
  cors: { origin: CLIENT_ORIGIN },
});

io.on("connection", (socket) => {
  socket.data.userId = null;
  socket.data.username = null;

  socket.on("auth:register", guard("auth:register", async (raw: unknown, rawCb: unknown) => {
    const cb = ackOf(rawCb);
    const { username, password } = payloadOf(raw);
    if (!isString(username) || !isString(password)) return cb({ ok: false, error: "Invalid request." });
    try {
      const res = await registerUser(username, password);
      if (!res.ok) return cb(res);
      const token = createSession(res.user);
      socket.data.userId = res.user.id;
      socket.data.username = res.user.username;
      cb({ ok: true, token, username: res.user.username, stats: (await statsForUser(res.user.id))! });
    } catch (err) {
      console.error("auth:register failed:", err);
      cb({ ok: false, error: "Server error. Please try again." });
    }
  }));

  socket.on("auth:login", guard("auth:login", async (raw: unknown, rawCb: unknown) => {
    const cb = ackOf(rawCb);
    const { username, password } = payloadOf(raw);
    if (!isString(username) || !isString(password)) return cb({ ok: false, error: "NOT_FOUND" });
    try {
      const res = await loginUser(username, password);
      if (!res.ok) return cb(res);
      const token = createSession(res.user);
      socket.data.userId = res.user.id;
      socket.data.username = res.user.username;
      cb({ ok: true, token, username: res.user.username, stats: (await statsForUser(res.user.id))! });
    } catch (err) {
      console.error("auth:login failed:", err);
      cb({ ok: false, error: "SERVER_ERROR" });
    }
  }));

  socket.on("auth:resume", guard("auth:resume", async (raw: unknown, rawCb: unknown) => {
    const cb = ackOf(rawCb);
    const { token } = payloadOf(raw);
    if (!isString(token)) return cb({ ok: false, error: "Session expired. Please log in again." });
    try {
      const user = resumeSession(token);
      if (!user) return cb({ ok: false, error: "Session expired. Please log in again." });
      socket.data.userId = user.id;
      socket.data.username = user.username;
      cb({ ok: true, token, username: user.username, stats: (await statsForUser(user.id))! });
    } catch (err) {
      console.error("auth:resume failed:", err);
      cb({ ok: false, error: "Server error. Please try again." });
    }
  }));

  socket.on("auth:logout", guard("auth:logout", (raw: unknown) => {
    const { token } = payloadOf(raw);
    if (isString(token)) destroySession(token);
    socket.data.userId = null;
    socket.data.username = null;
  }));

  socket.on("room:create", guard("room:create", (rawCb: unknown) => {
    const cb = ackOf(rawCb);
    if (!socket.data.userId || !socket.data.username) return cb({ ok: false, error: "Please log in first." });
    const room = createRoom(socket.id, socket.data.username, socket.data.userId);
    socket.join(room.code);
    cb({ ok: true, code: room.code });
    broadcastState(io, room);
  }));

  socket.on("room:join", guard("room:join", (raw: unknown, rawCb: unknown) => {
    const cb = ackOf(rawCb);
    const { code } = payloadOf(raw);
    if (!socket.data.userId || !socket.data.username) return cb({ ok: false, error: "Please log in first." });
    if (!isString(code)) return cb({ ok: false, error: "Room not found." });
    const room = getRoom(code);
    if (!room) return cb({ ok: false, error: "Room not found." });
    if (room.phase !== GamePhase.LOBBY) return cb({ ok: false, error: "Game already in progress." });
    if (room.seats.length >= MAX_PLAYERS) return cb({ ok: false, error: "Room is full." });
    room.seats.push({ socketId: socket.id, userId: socket.data.userId, name: socket.data.username, connected: true });
    socket.join(room.code);
    repairRoleCounts(room);
    cb({ ok: true });
    broadcastState(io, room);
  }));

  socket.on("room:start", guard("room:start", () => {
    const room = findRoomBySocket(socket.id);
    if (!room) return;
    startGame(io, room, socket.id);
  }));

  socket.on("room:configureRoles", guard("room:configureRoles", (raw: unknown) => {
    const { roleCounts } = payloadOf(raw);
    if (roleCounts === null || typeof roleCounts !== "object") return;
    const room = findRoomBySocket(socket.id);
    // configureRoles clamps each count itself, so only the object shape needs checking here.
    if (room) configureRoles(io, room, socket.id, roleCounts as RoleCounts);
  }));

  socket.on("room:playAgain", guard("room:playAgain", () => {
    const room = findRoomBySocket(socket.id);
    if (!room) return;
    resetForPlayAgain(io, room, socket.id);
  }));

  socket.on("night:werewolf:viewCenter", guard("night:werewolf:viewCenter", (raw: unknown) => {
    const { centerIndex } = payloadOf(raw);
    if (!isInt(centerIndex)) return;
    const room = findRoomBySocket(socket.id);
    if (room) handleWerewolfViewCenter(io, room, socket.id, centerIndex);
  }));

  socket.on("night:seer:target", guard("night:seer:target", (raw: unknown) => {
    const { playerSeat, centerIndices } = payloadOf(raw);
    if (playerSeat !== null && !isInt(playerSeat)) return;
    if (centerIndices !== null && !(Array.isArray(centerIndices) && centerIndices.every(isInt))) return;
    const room = findRoomBySocket(socket.id);
    if (room) handleSeerTarget(io, room, socket.id, playerSeat, centerIndices);
  }));

  socket.on("night:robber:target", guard("night:robber:target", (raw: unknown) => {
    const { playerSeat } = payloadOf(raw);
    if (!isInt(playerSeat)) return;
    const room = findRoomBySocket(socket.id);
    if (room) handleRobberTarget(io, room, socket.id, playerSeat);
  }));

  socket.on("night:troublemaker:swap", guard("night:troublemaker:swap", (raw: unknown) => {
    const { seatA, seatB } = payloadOf(raw);
    if (!isInt(seatA) || !isInt(seatB)) return;
    const room = findRoomBySocket(socket.id);
    if (room) handleTroublemakerSwap(io, room, socket.id, seatA, seatB);
  }));

  socket.on("night:insomniac:reveal", guard("night:insomniac:reveal", () => {
    const room = findRoomBySocket(socket.id);
    if (room) handleInsomniacReveal(io, room, socket.id);
  }));

  socket.on("day:chat", guard("day:chat", (raw: unknown) => {
    const { text } = payloadOf(raw);
    if (!isString(text)) return;
    const room = findRoomBySocket(socket.id);
    if (room) handleChat(io, room, socket.id, text);
  }));

  socket.on("vote:cast", guard("vote:cast", (raw: unknown) => {
    const { targetSocketId } = payloadOf(raw);
    if (!isString(targetSocketId)) return;
    const room = findRoomBySocket(socket.id);
    if (room) handleVoteCast(io, room, socket.id, targetSocketId);
  }));

  socket.on("hunter:target", guard("hunter:target", (raw: unknown) => {
    const { targetSocketId } = payloadOf(raw);
    if (!isString(targetSocketId)) return;
    const room = findRoomBySocket(socket.id);
    if (room) handleHunterTarget(io, room, socket.id, targetSocketId);
  }));

  socket.on("disconnect", guard("disconnect", () => {
    const room = findRoomBySocket(socket.id);
    if (!room) return;
    handleDisconnect(room, socket.id);
  }));
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
