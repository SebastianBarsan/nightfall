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
  roleDisplayName,
  RoleCounts,
  ROLE_REVEAL_DELAY_MS,
  ServerToClientEvents,
  validateRoleCounts,
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

  const roleError = validateRoleCounts(n, room.roleCounts);
  if (roleError) {
    io.to(requestorSocketId).emit("room:error", { message: roleError });
    return;
  }

  const deck = buildDeck(n, room.roleCounts);
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
  // Give everyone a beat to read their role reveal before the first night step's timer starts.
  room.gameStartTimer = setTimeout(() => {
    room.gameStartTimer = null;
    runNightStep(io, room);
  }, ROLE_REVEAL_DELAY_MS);
}

export function configureRoles(io: IO, room: ServerRoom, requestorSocketId: string, roleCounts: RoleCounts): void {
  if (requestorSocketId !== room.hostSocketId) {
    io.to(requestorSocketId).emit("room:error", { message: "Only the host can configure roles." });
    return;
  }
  if (room.phase !== GamePhase.LOBBY) {
    io.to(requestorSocketId).emit("room:error", { message: "Roles can only be changed in the lobby." });
    return;
  }
  const n = room.seats.length;
  // Clamp obviously-bad input before storing; validateRoleCounts (run again on room:start) is the
  // real gate on legality — this just stops NaN/negative/huge values from ever being stored.
  room.roleCounts = {
    werewolf: Math.max(0, Math.min(roleCounts.werewolf | 0, n)),
    insomniac: roleCounts.insomniac === 1 ? 1 : 0,
    hunter: roleCounts.hunter === 1 ? 1 : 0,
    villager: Math.max(0, roleCounts.villager | 0),
  };
  room.roleCountsCustomized = true;
  broadcastState(io, room);
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

/**
 * Every role in NIGHT_ORDER gets called and gets the same on-screen duration, whether or not any
 * player actually holds that card (it may be in the center instead). Otherwise, which steps get
 * skipped — and how fast — would itself reveal which roles are and aren't in play, the same way a
 * real moderator always calls "Werewolves, wake up" even when both wolf cards are in the center.
 */
function runNightStep(io: IO, room: ServerRoom): void {
  if (room.nightStepIndex >= NIGHT_ORDER.length) {
    room.currentNightStep = null;
    startDayPhase(io, room);
    return;
  }

  const role = NIGHT_ORDER[room.nightStepIndex];
  const activeSeats = originalSeatsWithRole(room, role);
  const endsAt = Date.now() + NIGHT_STEP_DURATION_MS;
  room.currentNightStep = { role, activeSeats, timer: null, acted: new Set(), endsAt };
  broadcastState(io, room);
  pingInactiveSockets(io, room, activeSeats);

  if (activeSeats.length === 0) {
    log(room, {
      role,
      actorSocketId: null,
      actorName: null,
      description: `${roleDisplayName(role)} card is in the center; no player acted.`,
    });
    room.currentNightStep.timer = setTimeout(() => advanceNightStep(io, room), NIGHT_STEP_DURATION_MS);
    return;
  }

  if (role === Role.WEREWOLF) {
    if (activeSeats.length > 1) {
      activeSeats.forEach((seat) => {
        const fellow = activeSeats.filter((s) => s !== seat).map((s) => room.seats[s].socketId);
        io.to(room.seats[seat].socketId).emit("werewolf:teamReveal", { fellowWolfSocketIds: fellow });
      });
      log(room, {
        role,
        actorSocketId: null,
        actorName: null,
        description: `Vampires recognized each other: ${activeSeats.map((s) => nameAt(room, s)).join(", ")}.`,
      });
      // Informational only — brief pause so clients can render it, then advance.
      room.currentNightStep.timer = setTimeout(() => advanceNightStep(io, room), NIGHT_STEP_DURATION_MS);
      return;
    }
    // Lone wolf: chooses a center card to peek at.
    const wolfSeat = activeSeats[0];
    io.to(room.seats[wolfSeat].socketId).emit("werewolf:centerPrompt", {
      availableCenterIndices: centerIndices(room),
    });
    // The timer — never the action itself — is what ends this step, so a fast tap and a
    // never-used turn take the exact same wall-clock time and can't be told apart by timing.
    room.currentNightStep.timer = setTimeout(() => {
      if (!room.currentNightStep?.acted.has(wolfSeat)) {
        log(room, {
          role,
          actorSocketId: room.seats[wolfSeat].socketId,
          actorName: nameAt(room, wolfSeat),
          description: "Lone vampire did not view a center card in time.",
        });
      }
      advanceNightStep(io, room);
    }, NIGHT_STEP_DURATION_MS);
    return;
  }

  if (role === Role.SEER) {
    const seat = activeSeats[0];
    io.to(room.seats[seat].socketId).emit("seer:prompt");
    room.currentNightStep.timer = setTimeout(() => {
      if (!room.currentNightStep?.acted.has(seat)) {
        log(room, {
          role,
          actorSocketId: room.seats[seat].socketId,
          actorName: nameAt(room, seat),
          description: "Oracle did not act in time.",
        });
      }
      advanceNightStep(io, room);
    }, NIGHT_STEP_DURATION_MS);
    return;
  }

  if (role === Role.ROBBER) {
    const seat = activeSeats[0];
    io.to(room.seats[seat].socketId).emit("robber:prompt");
    room.currentNightStep.timer = setTimeout(() => {
      if (!room.currentNightStep?.acted.has(seat)) {
        log(room, {
          role,
          actorSocketId: room.seats[seat].socketId,
          actorName: nameAt(room, seat),
          description: "Thief did not act in time.",
        });
      }
      advanceNightStep(io, room);
    }, NIGHT_STEP_DURATION_MS);
    return;
  }

  if (role === Role.TROUBLEMAKER) {
    const seat = activeSeats[0];
    io.to(room.seats[seat].socketId).emit("troublemaker:prompt");
    room.currentNightStep.timer = setTimeout(() => {
      if (!room.currentNightStep?.acted.has(seat)) {
        log(room, {
          role,
          actorSocketId: room.seats[seat].socketId,
          actorName: nameAt(room, seat),
          description: "Troublemaker did not act in time.",
        });
      }
      advanceNightStep(io, room);
    }, NIGHT_STEP_DURATION_MS);
    return;
  }

  if (role === Role.INSOMNIAC) {
    const seat = activeSeats[0];
    io.to(room.seats[seat].socketId).emit("insomniac:prompt");
    room.currentNightStep.timer = setTimeout(() => {
      if (!room.currentNightStep?.acted.has(seat)) {
        log(room, {
          role,
          actorSocketId: room.seats[seat].socketId,
          actorName: nameAt(room, seat),
          description: "Sentry did not check their card in time.",
        });
      }
      advanceNightStep(io, room);
    }, NIGHT_STEP_DURATION_MS);
    return;
  }
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
    description: `Lone vampire ${nameAt(room, seat)} viewed center card ${centerIndex}: ${roleDisplayName(viewedRole)}.`,
  });
  // Deliberately no advanceNightStep() here — the step's own timer (started in runNightStep)
  // is the only thing that ends it, so acting early never shortens the turn.
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
      io.to(socketId).emit("room:error", { message: "Invalid Oracle target." });
      return;
    }
    roles = [room.cardArray![playerSeat]];
    description = `Oracle ${nameAt(room, seat)} viewed ${nameAt(room, playerSeat)}'s card: ${roleDisplayName(roles[0])}.`;
  } else if (centerIdxs && centerIdxs.length === 2) {
    if (centerIdxs.some((i) => !isCenterIndex(room, i)) || centerIdxs[0] === centerIdxs[1]) {
      io.to(socketId).emit("room:error", { message: "Invalid center card selection." });
      return;
    }
    roles = centerIdxs.map((i) => room.cardArray![i]);
    description = `Oracle ${nameAt(room, seat)} viewed center cards ${centerIdxs.join(", ")}: ${roles.map(roleDisplayName).join(", ")}.`;
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
  // No advanceNightStep() — see handleWerewolfViewCenter for why.
}

export function handleRobberTarget(io: IO, room: ServerRoom, socketId: string, playerSeat: number): void {
  const seat = currentActiveSeat(room, Role.ROBBER, socketId);
  if (seat === null) return;
  if (playerSeat < 0 || playerSeat >= room.seats.length || playerSeat === seat) {
    io.to(socketId).emit("room:error", { message: "Invalid Thief target." });
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
    description: `Thief ${nameAt(room, seat)} swapped cards with ${nameAt(room, playerSeat)} and is now ${roleDisplayName(arr[seat])}.`,
  });
  // No advanceNightStep() — see handleWerewolfViewCenter for why.
}

export function handleInsomniacReveal(io: IO, room: ServerRoom, socketId: string): void {
  const seat = currentActiveSeat(room, Role.INSOMNIAC, socketId);
  if (seat === null) return;
  room.currentNightStep!.acted.add(seat);
  const currentRole = room.cardArray![seat];
  io.to(socketId).emit("insomniac:result", { currentRole });
  log(room, {
    role: Role.INSOMNIAC,
    actorSocketId: socketId,
    actorName: nameAt(room, seat),
    description: `Sentry ${nameAt(room, seat)} checked their card and is now ${roleDisplayName(currentRole)}.`,
  });
  // No advanceNightStep() — see handleWerewolfViewCenter for why.
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
  // No advanceNightStep() — see handleWerewolfViewCenter for why.
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

  // Only a single, outright vote leader is eliminated; a tie for the most votes kills no one.
  const topVoted = max > 0 ? [...tally.entries()].filter(([, c]) => c === max) : [];
  const eliminatedSocketIds = topVoted.length === 1 ? [topVoted[0][0]] : [];
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

  finalizeReveal(io, room, eliminatedSeats, null);
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
  const topVoted = max > 0 ? [...tally.entries()].filter(([, c]) => c === max) : [];
  return topVoted.length === 1 ? [seatIndexOf(room, topVoted[0][0])] : [];
}

function resolveHunter(io: IO, room: ServerRoom, baseEliminatedSeats: number[], extraSeat: number | null): void {
  room.hunterSubPhase = null;
  if (extraSeat !== null) {
    log(room, {
      role: Role.HUNTER,
      actorSocketId: room.seats.find((_, i) => baseEliminatedSeats.includes(i))?.socketId ?? null,
      actorName: null,
      description: `Hunter took ${nameAt(room, extraSeat)} down with them.`,
    });
  }
  finalizeReveal(io, room, baseEliminatedSeats, extraSeat);
}

// ---------------------------------------------------------------------------
// Reveal & victory evaluation
// ---------------------------------------------------------------------------

function finalizeReveal(
  io: IO,
  room: ServerRoom,
  voteEliminatedSeats: number[],
  hunterShotSeat: number | null,
): void {
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

  const eliminatedSeats =
    hunterShotSeat !== null ? [...new Set([...voteEliminatedSeats, hunterShotSeat])] : voteEliminatedSeats;

  // The Jester only wins by being the player the village directly voted out — getting caught
  // by the Hunter's follow-up shot doesn't count (see the HUNTER branch below), and nothing
  // else does either. A Jester win is exclusive of Village/Werewolf: nobody else wins with them.
  const votedSeat = voteEliminatedSeats[0] ?? null;
  const votedRole = votedSeat !== null ? finalArray[votedSeat] : null;
  const tannerWins = votedRole === Role.TANNER;

  let villageWins: boolean;
  let werewolfWins: boolean;

  if (tannerWins) {
    villageWins = false;
    werewolfWins = false;
  } else if (wolfSeatsInPlay.length === 0) {
    // No Vampire card is even in play among the seated players — nothing for the village to
    // catch. The village wins only if nobody died chasing a threat that wasn't there.
    villageWins = eliminatedSeats.length === 0;
    werewolfWins = false;
  } else if (votedRole === Role.HUNTER) {
    // The village voted out the Hunter, who gets one follow-up shot. Catching a Vampire wins
    // it for the village; catching the Jester is a non-event that still favors the village (the
    // Jester does not win this way, per tannerWins above); anything else lets the Vampires win.
    const shotRole = hunterShotSeat !== null ? finalArray[hunterShotSeat] : null;
    villageWins = shotRole === Role.WEREWOLF || shotRole === Role.TANNER;
    werewolfWins = !villageWins;
  } else {
    villageWins = votedRole === Role.WEREWOLF;
    werewolfWins = !villageWins;
  }

  const winningFactions: GameResult["winningFactions"] = [];
  if (villageWins) winningFactions.push("VILLAGE");
  if (werewolfWins) winningFactions.push("WEREWOLF");
  if (tannerWins) winningFactions.push("TANNER");

  const players: PlayerResult[] = room.seats.map((seat, i) => {
    const finalRole = finalArray[i];
    const eliminated = eliminatedSeats.includes(i);
    const won = finalRole === Role.TANNER ? tannerWins : finalRole === Role.WEREWOLF ? werewolfWins : villageWins;
    return {
      socketId: seat.socketId,
      name: seat.name,
      originalRole: originalArray[i],
      finalRole,
      eliminated,
      won,
    };
  });

  const mvp = computeMvp(room, players, tannerWins);

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
  tannerWins: boolean,
): GameResult["mvp"] {
  if (tannerWins) {
    const tanner = players.find((p) => p.finalRole === Role.TANNER && p.eliminated);
    if (tanner) return { socketId: tanner.socketId, name: tanner.name, reason: "Successfully engineered their own elimination." };
  }
  for (const [voterId, targetId] of room.votes.entries()) {
    const target = players.find((p) => p.socketId === targetId);
    const voter = players.find((p) => p.socketId === voterId);
    if (target?.eliminated && target.finalRole === Role.WEREWOLF && voter) {
      return { socketId: voter.socketId, name: voter.name, reason: "Correctly voted out a Vampire." };
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
    if (room.gameStartTimer) clearTimeout(room.gameStartTimer);
    if (room.dayTimer) clearTimeout(room.dayTimer);
    if (room.votingTimer) clearTimeout(room.votingTimer);
    if (room.currentNightStep?.timer) clearTimeout(room.currentNightStep.timer);
    if (room.hunterSubPhase?.timer) clearTimeout(room.hunterSubPhase.timer);
    deleteRoom(room.code);
  }
}
