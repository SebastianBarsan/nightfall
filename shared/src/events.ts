import type { Role, RoleCounts } from "./roles.js";
import type { ChatMessage, RoomSnapshot } from "./types.js";

// ---- Client -> Server ----
export interface ClientToServerEvents {
  "room:create": (payload: { name: string }, cb: (res: { ok: true; code: string } | { ok: false; error: string }) => void) => void;
  "room:join": (payload: { code: string; name: string }, cb: (res: { ok: true } | { ok: false; error: string }) => void) => void;
  "room:start": () => void;
  "room:playAgain": () => void;
  "room:configureRoles": (payload: { roleCounts: RoleCounts }) => void;

  "night:werewolf:viewCenter": (payload: { centerIndex: number }) => void;
  "night:seer:target": (payload: { playerSeat: number | null; centerIndices: number[] | null }) => void;
  "night:robber:target": (payload: { playerSeat: number }) => void;
  "night:troublemaker:swap": (payload: { seatA: number; seatB: number }) => void;
  "night:insomniac:reveal": () => void;

  "coin:tap": () => void;

  "day:chat": (payload: { text: string }) => void;

  "vote:cast": (payload: { targetSocketId: string }) => void;
  "hunter:target": (payload: { targetSocketId: string }) => void;
}

// ---- Server -> Client ----
export interface ServerToClientEvents {
  "room:state": (snapshot: RoomSnapshot) => void;
  "room:error": (payload: { message: string }) => void;

  "night:yourRole": (payload: { role: Role }) => void;
  "coin:spawn": () => void;

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
