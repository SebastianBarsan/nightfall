import type { Role, RoleCounts } from "./roles.js";
import type { ChatMessage, PlayerStats, RoomSnapshot } from "./types.js";

export type AuthOk = { ok: true; token: string; username: string; stats: PlayerStats };
export type AuthResult = AuthOk | { ok: false; error: string };
export type LoginResult = AuthOk | { ok: false; error: "NOT_FOUND" | "WRONG_PASSWORD" | "SERVER_ERROR" };

// ---- Client -> Server ----
export interface ClientToServerEvents {
  "auth:register": (payload: { username: string; password: string }, cb: (res: AuthResult) => void) => void;
  "auth:login": (payload: { username: string; password: string }, cb: (res: LoginResult) => void) => void;
  "auth:resume": (payload: { token: string }, cb: (res: AuthResult) => void) => void;
  "auth:logout": (payload: { token: string }) => void;

  "room:create": (cb: (res: { ok: true; code: string } | { ok: false; error: string }) => void) => void;
  "room:join": (payload: { code: string }, cb: (res: { ok: true } | { ok: false; error: string }) => void) => void;
  "room:start": () => void;
  "room:playAgain": () => void;
  "room:configureRoles": (payload: { roleCounts: RoleCounts }) => void;

  "night:werewolf:viewCenter": (payload: { centerIndex: number }) => void;
  "night:seer:target": (payload: { playerSeat: number | null; centerIndices: number[] | null }) => void;
  "night:robber:target": (payload: { playerSeat: number }) => void;
  "night:troublemaker:swap": (payload: { seatA: number; seatB: number }) => void;
  "night:insomniac:reveal": () => void;

  "day:chat": (payload: { text: string }) => void;

  "vote:cast": (payload: { targetSocketId: string }) => void;
  "hunter:target": (payload: { targetSocketId: string }) => void;
}

// ---- Server -> Client ----
export interface ServerToClientEvents {
  "room:state": (snapshot: RoomSnapshot) => void;
  "room:error": (payload: { message: string }) => void;

  "night:yourRole": (payload: { role: Role }) => void;
  "stats:update": (payload: { stats: PlayerStats }) => void;

  "werewolf:teamReveal": (payload: { fellowWolfSocketIds: string[] }) => void;
  "werewolf:centerPrompt": (payload: { availableCenterIndices: number[] }) => void;
  "werewolf:centerResult": (payload: { centerIndex: number; role: Role }) => void;

  "seer:prompt": () => void;
  "seer:result": (payload: { roles: Role[]; viewedPlayerSeat: number | null; viewedCenterIndices: number[] | null }) => void;

  "robber:prompt": () => void;
  "robber:result": (payload: { newRole: Role }) => void;

  "troublemaker:prompt": () => void;
  "troublemaker:ack": () => void;

  "insomniac:prompt": () => void;
  "insomniac:result": (payload: { currentRole: Role }) => void;

  "day:start": (payload: { endsAt: number }) => void;
  "day:chat": (payload: ChatMessage) => void;

  "voting:start": (payload: { endsAt: number }) => void;

  "hunter:prompt": (payload: { endsAt: number }) => void;
}
