import type { Server } from "socket.io";
import {
  ActionLogEntry,
  buildDeck,
  CENTER_CARD_COUNT,
  ClientToServerEvents,
  GamePhase,
  GameResult,
  HUNTER_SUBPHASE_DURATION_MS,
  MAX_PLAYERS,
  MIN_PLAYERS,
  NIGHT_ORDER,
  NIGHT_STEP_DURATION_MS,
  PlayerResult,
  Role,
  ServerToClientEvents,
  VOTING_DURATION_MS,
} from "@nightfall/shared";
import { deleteRoom, seatIndexOf, ServerRoom } from "./roomStore.js";
import { buildSnapshot } from "./snapshot.js";

export type IO = Server<ClientToServerEvents, ServerToClientEvents>;

export function broadcastState(io: IO, room: ServerRoom): void {
  io.to(room.code).emit("room:state", buildSnapshot(room));
}

function log(room: ServerRoom, entry: Omit<ActionLogEntry, "timestamp">): void {
  room.actionLog.push({ ...entry, timestamp: Date.now() });
}

function nameAt(room: ServerRoom, seat: number): string {
  return room.seats[seat]?.name ?? "Unknown";
}

// ---------------------------------------------------------------------------
// Game start / dealing
// ---------------------------------------------------------------------------

export function startGame(io: IO, room: ServerRoom, requestorSocketId: string): void {
  if (requestorSocketId !== room.hostSocketId) {
    io.to(requestorSocketId).emit("room:error", { message: "Only the host can start the game." });
    return;
  }
  if (room.phase !== GamePhase.LOBBY) {
    io.to(requestorSocketId).emit("room:error", { message: "Game already in progress." });
    return;
  }
  const n = room.seats.length;
  if (n < MIN_PLAYERS || n > MAX_PLAYERS) {
    io.to(requestorSocketId).emit("room:error", {
      message: `Nightfall requires ${MIN_PLAYERS}-${MAX_PLAYERS} players (currently ${n}).`,
    });
    return;
  }

  const deck = buildDeck(n);
  room.originalArray = [...deck];
  room.cardArray = [...deck];
  room.actionLog = [];
  room.chat = [];
  room.result = null;
  room.votes.clear();
  room.phase = GamePhase.NIGHT;
  room.nightStepIndex = 0;

  room.seats.forEach((seat, i) => {
    io.to(seat.socketId).emit("night:yourRole", { role: deck[i] });
  });

  broadcastState(io, room);
  runNightStep(io, room);
}

// ---------------------------------------------------------------------------
// Night phase: sequential role resolution
// ---------------------------------------------------------------------------

function originalSeatsWithRole(room: ServerRoom, role: Role): number[] {
  const original = room.originalArray!;
  const seats: number[] = [];
  for (let i = 0; i < room.seats.length; i++) {
    if (original[i] === role) seats.push(i);
  }
  return seats;
}

function pingInactiveSockets(io: IO, room: ServerRoom, activeSeats: number[]): void {
  const activeIds = new Set(activeSeats.map((s) => room.seats[s].socketId));
  for (const seat of room.seats) {
    if (!activeIds.has(seat.socketId) && seat.connected) {
      io.to(seat.socketId).emit("coin:spawn");
    }
  }
}

function runNightStep(io: IO, room: ServerRoom): void {
  if (room.nightStepIndex >= NIGHT_ORDER.length) {
    room.currentNightStep = null;
    startDayPhase(io, room);
    return;
  }

  const role = NIGHT_ORDER[room.nightStepIndex];

  if (role === Role.WEREWOLF) {
    const wolves = originalSeatsWithRole(room, Role.WEREWOLF);
    if (wolves.length === 0) {
      log(room, {
        role,
        actorSocketId: null,
        actorName: null,
        description: "No player holds a Werewolf card; both wolves are in the center.",
      });
      advanceNightStep(io, room);
      return;
    }
    if (wolves.length > 1) {
      wolves.forEach((seat) => {
        const fellow = wolves.filter((s) => s !== seat).map((s) => room.seats[s].socketId);
        io.to(room.seats[seat].socketId).emit("werewolf:teamReveal", { fellowWolfSocketIds: fellow });
      });
      log(room, {
        role,
        actorSocketId: null,
        actorName: null,
        description: `Werewolves recognized each other: ${wolves.map((s) => nameAt(room, s)).join(", ")}.`,
      });
      room.currentNightStep = { role, activeSeats: wolves, timer: null, acted: new Set(wolves) };
      pingInactiveSockets(io, room, wolves);
      // Informational only — brief pause so clients can render it, then advance.
      const timer = setTimeout(() => advanceNightStep(io, room), NIGHT_STEP_DURATION_MS);
      room.currentNightStep.timer = timer;
      return;
    }
    // Lone wolf: chooses a center card to peek at.
    const wolfSeat = wolves[0];
    room.currentNightStep = { role, activeSeats: [wolfSeat], timer: null, acted: new Set() };
    io.to(room.seats[wolfSeat].socketId).emit("werewolf:centerPrompt", {
      availableCenterIndices: centerIndices(room),
    });
    pingInactiveSockets(io, room, [wolfSeat]);
    room.currentNightStep.timer = setTimeout(() => {
      log(room, {
        role,
        actorSocketId: room.seats[wolfSeat].socketId,
        actorName: nameAt(room, wolfSeat),
        description: "Lone wolf did not view a center card in time.",
      });
      advanceNightStep(io, room);
    }, NIGHT_STEP_DURATION_MS);
    return;
  }

  if (role === Role.SEER) {
    const seers = originalSeatsWithRole(room, Role.SEER);
    if (seers.length === 0) return skipStep(io, room, role);
    const seat = seers[0];
    room.currentNightStep = { role, activeSeats: [seat], timer: null, acted: new Set() };
    io.to(room.seats[seat].socketId).emit("seer:prompt");
    pingInactiveSockets(io, room, [seat]);
    room.currentNightStep.timer = setTimeout(() => {
      log(room, {
        role,
        actorSocketId: room.seats[seat].socketId,
        actorName: nameAt(room, seat),
        description: "Seer did not act in time.",
      });
      advanceNightStep(io, room);
    }, NIGHT_STEP_DURATION_MS);
    return;
  }

  if (role === Role.ROBBER) {
    const robbers = originalSeatsWithRole(room, Role.ROBBER);
    if (robbers.length === 0) return skipStep(io, room, role);
    const seat = robbers[0];
    room.currentNightStep = { role, activeSeats: [seat], timer: null, acted: new Set() };
    io.to(room.seats[seat].socketId).emit("robber:prompt");
    pingInactiveSockets(io, room, [seat]);
    room.currentNightStep.timer = setTimeout(() => {
      log(room, {
        role,
        actorSocketId: room.seats[seat].socketId,
        actorName: nameAt(room, seat),
        description: "Robber did not act in time.",
      });
      advanceNightStep(io, room);
    }, NIGHT_STEP_DURATION_MS);
    return;
  }

  if (role === Role.TROUBLEMAKER) {
    const tms = originalSeatsWithRole(room, Role.TROUBLEMAKER);
    if (tms.length === 0) return skipStep(io, room, role);
    const seat = tms[0];
    room.currentNightStep = { role, activeSeats: [seat], timer: null, acted: new Set() };
    io.to(room.seats[seat].socketId).emit("troublemaker:prompt");
    pingInactiveSockets(io, room, [seat]);
    room.currentNightStep.timer = setTimeout(() => {
      log(room, {
        role,
        actorSocketId: room.seats[seat].socketId,
        actorName: nameAt(room, seat),
        description: "Troublemaker did not act in time.",
      });
      advanceNightStep(io, room);
    }, NIGHT_STEP_DURATION_MS);
    return;
  }

  if (role === Role.INSOMNIAC) {
    const insomniacs = originalSeatsWithRole(room, Role.INSOMNIAC);
    if (insomniacs.length === 0) return skipStep(io, room, role);
    const seat = insomniacs[0];
    const currentRole = room.cardArray![seat];
    io.to(room.seats[seat].socketId).emit("insomniac:result", { currentRole });
    log(room, {
      role,
      actorSocketId: room.seats[seat].socketId,
      actorName: nameAt(room, seat),
      description: `Insomniac checked their card and is now ${currentRole}.`,
    });
    room.currentNightStep = { role, activeSeats: [seat], timer: null, acted: new Set([seat]) };
    pingInactiveSockets(io, room, [seat]);
    room.currentNightStep.timer = setTimeout(() => advanceNightStep(io, room), NIGHT_STEP_DURATION_MS);
    return;
  }
}

function skipStep(io: IO, room: ServerRoom, role: Role): void {
  log(room, {
    role,
    actorSocketId: null,
    actorName: null,
    description: `${role} card is in the center; no player acted.`,
  });
  room.nightStepIndex++;
  runNightStep(io, room);
}

function advanceNightStep(io: IO, room: ServerRoom): void {
  if (room.currentNightStep?.timer) clearTimeout(room.currentNightStep.timer);
  room.currentNightStep = null;
  room.nightStepIndex++;
  runNightStep(io, room);
}

function centerIndices(room: ServerRoom): number[] {
  const n = room.seats.length;
  return [n, n + 1, n + 2];
}

function isCenterIndex(room: ServerRoom, index: number): boolean {
  const n = room.seats.length;
  return index >= n && index < n + CENTER_CARD_COUNT;
}

function currentActiveSeat(room: ServerRoom, role: Role, socketId: string): number | null {
  if (!room.currentNightStep || room.currentNightStep.role !== role) return null;
  const seat = seatIndexOf(room, socketId);
  if (!room.currentNightStep.activeSeats.includes(seat)) return null;
  if (room.currentNightStep.acted.has(seat)) return null;
  return seat;
}

export function handleWerewolfViewCenter(io: IO, room: ServerRoom, socketId: string, centerIndex: number): void {
  const seat = currentActiveSeat(room, Role.WEREWOLF, socketId);
  if (seat === null) return;
  if (!isCenterIndex(room, centerIndex)) {
    io.to(socketId).emit("room:error", { message: "Invalid center card index." });
    return;
  }
  room.currentNightStep!.acted.add(seat);
  const viewedRole = room.cardArray![centerIndex];
  io.to(socketId).emit("werewolf:centerResult", { centerIndex, role: viewedRole });
  log(room, {
    role: Role.WEREWOLF,
    actorSocketId: socketId,
    actorName: nameAt(room, seat),
    description: `Lone wolf ${nameAt(room, seat)} viewed center card ${centerIndex}: ${viewedRole}.`,
  });
  advanceNightStep(io, room);
}

export function handleSeerTarget(
  io: IO,
  room: ServerRoom,
  socketId: string,
  playerSeat: number | null,
  centerIdxs: number[] | null,
): void {
  const seat = currentActiveSeat(room, Role.SEER, socketId);
  if (seat === null) return;

  let roles: Role[];
  let description: string;
  if (playerSeat !== null) {
    if (playerSeat < 0 || playerSeat >= room.seats.length || playerSeat === seat) {
      io.to(socketId).emit("room:error", { message: "Invalid Seer target." });
      return;
    }
    roles = [room.cardArray![playerSeat]];
    description = `Seer ${nameAt(room, seat)} viewed ${nameAt(room, playerSeat)}'s card: ${roles[0]}.`;
  } else if (centerIdxs && centerIdxs.length === 2) {
    if (centerIdxs.some((i) => !isCenterIndex(room, i)) || centerIdxs[0] === centerIdxs[1]) {
      io.to(socketId).emit("room:error", { message: "Invalid center card selection." });
      return;
    }
    roles = centerIdxs.map((i) => room.cardArray![i]);
    description = `Seer ${nameAt(room, seat)} viewed center cards ${centerIdxs.join(", ")}: ${roles.join(", ")}.`;
  } else {
    io.to(socketId).emit("room:error", { message: "Choose one player or two center cards." });
    return;
  }

  room.currentNightStep!.acted.add(seat);
  io.to(socketId).emit("seer:result", {
    roles,
    viewedPlayerSeat: playerSeat,
    viewedCenterIndices: centerIdxs,
  });
  log(room, { role: Role.SEER, actorSocketId: socketId, actorName: nameAt(room, seat), description });
  advanceNightStep(io, room);
}

export function handleRobberTarget(io: IO, room: ServerRoom, socketId: string, playerSeat: number): void {
  const seat = currentActiveSeat(room, Role.ROBBER, socketId);
  if (seat === null) return;
  if (playerSeat < 0 || playerSeat >= room.seats.length || playerSeat === seat) {
    io.to(socketId).emit("room:error", { message: "Invalid Robber target." });
    return;
  }
  room.currentNightStep!.acted.add(seat);
  const arr = room.cardArray!;
  [arr[seat], arr[playerSeat]] = [arr[playerSeat], arr[seat]];
  io.to(socketId).emit("robber:result", { newRole: arr[seat] });
  log(room, {
    role: Role.ROBBER,
    actorSocketId: socketId,
    actorName: nameAt(room, seat),
    description: `Robber ${nameAt(room, seat)} swapped cards with ${nameAt(room, playerSeat)} and is now ${arr[seat]}.`,
  });
  advanceNightStep(io, room);
}

export function handleTroublemakerSwap(io: IO, room: ServerRoom, socketId: string, seatA: number, seatB: number): void {
  const seat = currentActiveSeat(room, Role.TROUBLEMAKER, socketId);
  if (seat === null) return;
  const n = room.seats.length;
  if (
    seatA < 0 || seatA >= n || seatB < 0 || seatB >= n ||
    seatA === seatB || seatA === seat || seatB === seat
  ) {
    io.to(socketId).emit("room:error", { message: "Invalid Troublemaker targets." });
    return;
  }
  room.currentNightStep!.acted.add(seat);
  const arr = room.cardArray!;
  [arr[seatA], arr[seatB]] = [arr[seatB], arr[seatA]];
  io.to(socketId).emit("troublemaker:ack");
  log(room, {
    role: Role.TROUBLEMAKER,
    actorSocketId: socketId,
    actorName: nameAt(room, seat),
    description: `Troublemaker ${nameAt(room, seat)} swapped ${nameAt(room, seatA)} and ${nameAt(room, seatB)}'s cards.`,
  });
  advanceNightStep(io, room);
}

// ---------------------------------------------------------------------------
// Day phase
// ---------------------------------------------------------------------------

function startDayPhase(io: IO, room: ServerRoom): void {
  room.phase = GamePhase.DAY;
  room.dayEndsAt = Date.now() + room.settings.dayDurationSec * 1000;
  broadcastState(io, room);
  io.to(room.code).emit("day:start", { endsAt: room.dayEndsAt });
  room.dayTimer = setTimeout(() => startVotingPhase(io, room), room.settings.dayDurationSec * 1000);
}

export function handleChat(io: IO, room: ServerRoom, socketId: string, text: string): void {
  if (room.phase !== GamePhase.DAY) return;
  const trimmed = text.trim().slice(0, 300);
  if (!trimmed) return;
  const seat = seatIndexOf(room, socketId);
  if (seat === -1) return;
  const message = { socketId, name: nameAt(room, seat), text: trimmed, timestamp: Date.now() };
  room.chat.push(message);
  if (room.chat.length > 200) room.chat.shift();
  io.to(room.code).emit("day:chat", message);
}

// ---------------------------------------------------------------------------
// Voting phase
// ---------------------------------------------------------------------------

function startVotingPhase(io: IO, room: ServerRoom): void {
  if (room.dayTimer) clearTimeout(room.dayTimer);
  room.dayTimer = null;
  room.phase = GamePhase.VOTING;
  room.votes.clear();
  room.votingEndsAt = Date.now() + VOTING_DURATION_MS;
  broadcastState(io, room);
  io.to(room.code).emit("voting:start", { endsAt: room.votingEndsAt });
  room.votingTimer = setTimeout(() => resolveVoting(io, room), VOTING_DURATION_MS);
}

export function handleVoteCast(io: IO, room: ServerRoom, socketId: string, targetSocketId: string): void {
  if (room.phase !== GamePhase.VOTING) return;
  if (socketId === targetSocketId) {
    io.to(socketId).emit("room:error", { message: "You cannot vote for yourself." });
    return;
  }
  const targetSeat = seatIndexOf(room, targetSocketId);
  if (targetSeat === -1) {
    io.to(socketId).emit("room:error", { message: "Invalid vote target." });
    return;
  }
  room.votes.set(socketId, targetSocketId);
  broadcastState(io, room);

  const connectedSeats = room.seats.filter((s) => s.connected);
  const allVoted = connectedSeats.every((s) => room.votes.has(s.socketId));
  if (allVoted) {
    if (room.votingTimer) clearTimeout(room.votingTimer);
    resolveVoting(io, room);
  }
}

function resolveVoting(io: IO, room: ServerRoom): void {
  room.votingTimer = null;
  const tally = new Map<string, number>();
  for (const targetId of room.votes.values()) {
    tally.set(targetId, (tally.get(targetId) ?? 0) + 1);
  }
  let max = 0;
  for (const count of tally.values()) max = Math.max(max, count);

  const eliminatedSocketIds = max > 0 ? [...tally.entries()].filter(([, c]) => c === max).map(([id]) => id) : [];
  const eliminatedSeats = eliminatedSocketIds.map((id) => seatIndexOf(room, id)).filter((s) => s !== -1);

  const hunterSeat = eliminatedSeats.find((seat) => room.cardArray![seat] === Role.HUNTER);
  if (hunterSeat !== undefined) {
    room.phase = GamePhase.HUNTER_RESOLUTION;
    const hunterSocketId = room.seats[hunterSeat].socketId;
    const endsAt = Date.now() + HUNTER_SUBPHASE_DURATION_MS;
    const timer = setTimeout(() => resolveHunter(io, room, eliminatedSeats, null), HUNTER_SUBPHASE_DURATION_MS);
    room.hunterSubPhase = { hunterSocketId, hunterSeat, endsAt, timer };
    broadcastState(io, room);
    io.to(hunterSocketId).emit("hunter:prompt", { endsAt });
    return;
  }

  finalizeReveal(io, room, eliminatedSeats);
}

export function handleHunterTarget(io: IO, room: ServerRoom, socketId: string, targetSocketId: string): void {
  if (room.phase !== GamePhase.HUNTER_RESOLUTION || !room.hunterSubPhase) return;
  if (socketId !== room.hunterSubPhase.hunterSocketId) return;
  if (socketId === targetSocketId) {
    io.to(socketId).emit("room:error", { message: "The Hunter cannot target themselves." });
    return;
  }
  const targetSeat = seatIndexOf(room, targetSocketId);
  if (targetSeat === -1) {
    io.to(socketId).emit("room:error", { message: "Invalid Hunter target." });
    return;
  }
  clearTimeout(room.hunterSubPhase.timer);
  const originalEliminated = getLastVoteEliminatedSeats(room);
  resolveHunter(io, room, originalEliminated, targetSeat);
}

function getLastVoteEliminatedSeats(room: ServerRoom): number[] {
  const tally = new Map<string, number>();
  for (const targetId of room.votes.values()) {
    tally.set(targetId, (tally.get(targetId) ?? 0) + 1);
  }
  let max = 0;
  for (const count of tally.values()) max = Math.max(max, count);
  return max > 0
    ? [...tally.entries()].filter(([, c]) => c === max).map(([id]) => seatIndexOf(room, id))
    : [];
}

function resolveHunter(io: IO, room: ServerRoom, baseEliminatedSeats: number[], extraSeat: number | null): void {
  room.hunterSubPhase = null;
  const eliminatedSeats = extraSeat !== null ? [...new Set([...baseEliminatedSeats, extraSeat])] : baseEliminatedSeats;
  if (extraSeat !== null) {
    log(room, {
      role: Role.HUNTER,
      actorSocketId: room.seats.find((_, i) => baseEliminatedSeats.includes(i))?.socketId ?? null,
      actorName: null,
      description: `Hunter took ${nameAt(room, extraSeat)} down with them.`,
    });
  }
  finalizeReveal(io, room, eliminatedSeats);
}

// ---------------------------------------------------------------------------
// Reveal & victory evaluation
// ---------------------------------------------------------------------------

function finalizeReveal(io: IO, room: ServerRoom, eliminatedSeats: number[]): void {
  if (room.dayTimer) clearTimeout(room.dayTimer);
  if (room.votingTimer) clearTimeout(room.votingTimer);
  room.dayTimer = null;
  room.votingTimer = null;
  room.phase = GamePhase.REVEAL;

  const finalArray = room.cardArray!;
  const originalArray = room.originalArray!;
  const n = room.seats.length;

  const wolfSeatsInPlay: number[] = [];
  for (let i = 0; i < n; i++) if (finalArray[i] === Role.WEREWOLF) wolfSeatsInPlay.push(i);

  const aWolfWasEliminated = eliminatedSeats.some((s) => finalArray[s] === Role.WEREWOLF);
  const tannerEliminated = eliminatedSeats.some((s) => finalArray[s] === Role.TANNER);

  const villageWins = wolfSeatsInPlay.length > 0 ? aWolfWasEliminated : eliminatedSeats.length === 0;
  const werewolfWins = wolfSeatsInPlay.length > 0 ? !aWolfWasEliminated : false;

  const winningFactions: GameResult["winningFactions"] = [];
  if (villageWins) winningFactions.push("VILLAGE");
  if (werewolfWins) winningFactions.push("WEREWOLF");
  if (tannerEliminated) winningFactions.push("TANNER");

  const players: PlayerResult[] = room.seats.map((seat, i) => {
    const finalRole = finalArray[i];
    const eliminated = eliminatedSeats.includes(i);
    const won = finalRole === Role.TANNER ? eliminated : finalRole === Role.WEREWOLF ? werewolfWins : villageWins;
    return {
      socketId: seat.socketId,
      name: seat.name,
      originalRole: originalArray[i],
      finalRole,
      eliminated,
      won,
    };
  });

  const mvp = computeMvp(room, players, tannerEliminated);

  room.result = {
    initialArray: originalArray,
    finalArray,
    actionLog: room.actionLog,
    eliminatedSocketIds: eliminatedSeats.map((s) => room.seats[s].socketId),
    winningFactions,
    players,
    mvp,
  };

  broadcastState(io, room);
}

function computeMvp(
  room: ServerRoom,
  players: PlayerResult[],
  tannerEliminated: boolean,
): GameResult["mvp"] {
  if (tannerEliminated) {
    const tanner = players.find((p) => p.finalRole === Role.TANNER && p.eliminated);
    if (tanner) return { socketId: tanner.socketId, name: tanner.name, reason: "Successfully engineered their own elimination." };
  }
  for (const [voterId, targetId] of room.votes.entries()) {
    const target = players.find((p) => p.socketId === targetId);
    const voter = players.find((p) => p.socketId === voterId);
    if (target?.eliminated && target.finalRole === Role.WEREWOLF && voter) {
      return { socketId: voter.socketId, name: voter.name, reason: "Correctly voted out a Werewolf." };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Lobby reset
// ---------------------------------------------------------------------------

export function resetForPlayAgain(io: IO, room: ServerRoom, requestorSocketId: string): void {
  if (requestorSocketId !== room.hostSocketId) {
    io.to(requestorSocketId).emit("room:error", { message: "Only the host can start a new round." });
    return;
  }
  room.phase = GamePhase.LOBBY;
  room.cardArray = null;
  room.originalArray = null;
  room.actionLog = [];
  room.nightStepIndex = 0;
  room.currentNightStep = null;
  room.dayEndsAt = null;
  room.votingEndsAt = null;
  room.votes.clear();
  room.hunterSubPhase = null;
  room.chat = [];
  room.result = null;
  broadcastState(io, room);
}

export function cleanupEmptyRoom(room: ServerRoom): void {
  if (room.seats.every((s) => !s.connected)) {
    if (room.dayTimer) clearTimeout(room.dayTimer);
    if (room.votingTimer) clearTimeout(room.votingTimer);
    if (room.currentNightStep?.timer) clearTimeout(room.currentNightStep.timer);
    if (room.hunterSubPhase?.timer) clearTimeout(room.hunterSubPhase.timer);
    deleteRoom(room.code);
  }
}
