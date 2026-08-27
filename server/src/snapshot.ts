import type { RoomSnapshot } from "@nightfall/shared";
import type { ServerRoom } from "./roomStore.js";

export function buildSnapshot(room: ServerRoom): RoomSnapshot {
  return {
    code: room.code,
    hostSocketId: room.hostSocketId,
    phase: room.phase,
    players: room.seats.map((s, i) => ({
      socketId: s.socketId,
      name: s.name,
      connected: s.connected,
      seatIndex: i,
    })),
    settings: room.settings,
    dayEndsAt: room.dayEndsAt,
    votingEndsAt: room.votingEndsAt,
    hunterSubPhase: room.hunterSubPhase
      ? { hunterSocketId: room.hunterSubPhase.hunterSocketId, endsAt: room.hunterSubPhase.endsAt }
      : null,
    nightStep: room.currentNightStep
      ? { role: room.currentNightStep.role, endsAt: room.currentNightStep.endsAt }
      : null,
    votesCast: Array.from(room.votes.keys()),
    chat: room.chat,
    result: room.result,
  };
}
