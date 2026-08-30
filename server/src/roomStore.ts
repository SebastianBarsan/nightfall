import {
  ActionLogEntry,
  ChatMessage,
  defaultRoleCounts,
  DEFAULT_DAY_DURATION_SEC,
  GamePhase,
  GameResult,
  maxWerewolfCount,
  minWerewolfCount,
  Role,
  RoleCounts,
} from "@nightfall/shared";

export interface Seat {
  socketId: string;
  userId: number;
  name: string;
  connected: boolean;
}

export interface HunterSubPhase {
  hunterSocketId: string;
  hunterSeat: number;
  endsAt: number;
  timer: NodeJS.Timeout;
}

export interface NightStepState {
  role: Role;
  activeSeats: number[];
  timer: NodeJS.Timeout | null;
  acted: Set<number>;
  endsAt: number;
}

export interface ServerRoom {
  code: string;
  hostSocketId: string;
  seats: Seat[];
  phase: GamePhase;
  settings: { dayDurationSec: number };
  roleCounts: RoleCounts;
  roleCountsCustomized: boolean;

  cardArray: Role[] | null;
  originalArray: Role[] | null;
  actionLog: ActionLogEntry[];

  gameStartTimer: NodeJS.Timeout | null;
  nightStepIndex: number;
  currentNightStep: NightStepState | null;

  dayEndsAt: number | null;
  dayTimer: NodeJS.Timeout | null;

  votingEndsAt: number | null;
  votingTimer: NodeJS.Timeout | null;
  votes: Map<string, string>;

  hunterSubPhase: HunterSubPhase | null;

  chat: ChatMessage[];
  result: GameResult | null;
}

const rooms = new Map<string, ServerRoom>();

// Kept to exactly 4 letters each so every code is the same length (WORD-DDDD, 9
// chars) — a longer word here silently overflowed the join-code input's maxLength.
const CODE_WORDS = [
  "WOLF",
  "MOON",
  "HOWL",
  "DUSK",
  "FANG",
  "LORE",
  "PACK",
  "MIST",
  "CROW",
  "OMEN",
];

function generateRoomCode(): string {
  let code: string;
  do {
    const word = CODE_WORDS[Math.floor(Math.random() * CODE_WORDS.length)];
    const digits = Math.floor(1000 + Math.random() * 9000);
    code = `${word}-${digits}`;
  } while (rooms.has(code));
  return code;
}

export function createRoom(hostSocketId: string, hostName: string, hostUserId: number): ServerRoom {
  const code = generateRoomCode();
  const room: ServerRoom = {
    code,
    hostSocketId,
    seats: [{ socketId: hostSocketId, userId: hostUserId, name: hostName, connected: true }],
    phase: GamePhase.LOBBY,
    settings: { dayDurationSec: DEFAULT_DAY_DURATION_SEC },
    roleCounts: defaultRoleCounts(1),
    roleCountsCustomized: false,
    cardArray: null,
    originalArray: null,
    actionLog: [],
    gameStartTimer: null,
    nightStepIndex: 0,
    currentNightStep: null,
    dayEndsAt: null,
    dayTimer: null,
    votingEndsAt: null,
    votingTimer: null,
    votes: new Map(),
    hunterSubPhase: null,
    chat: [],
    result: null,
  };
  rooms.set(code, room);
  return room;
}

export function getRoom(code: string): ServerRoom | undefined {
  return rooms.get(code.toUpperCase());
}

export function findRoomBySocket(socketId: string): ServerRoom | undefined {
  for (const room of rooms.values()) {
    if (room.seats.some((s) => s.socketId === socketId)) return room;
  }
  return undefined;
}

export function deleteRoom(code: string): void {
  rooms.delete(code);
}

export function seatIndexOf(room: ServerRoom, socketId: string): number {
  return room.seats.findIndex((s) => s.socketId === socketId);
}

/**
 * Keeps roleCounts sane whenever the seat count changes in the lobby. Before the host has
 * touched the role editor, just recompute a fresh default so the game stays startable with no
 * setup. Once customized, only clamp Werewolf count back into its (now-new) legal range — every
 * other field is left alone; a resulting slot-count mismatch surfaces to the host to fix by hand.
 */
export function repairRoleCounts(room: ServerRoom): void {
  const n = room.seats.length;
  if (!room.roleCountsCustomized) {
    room.roleCounts = defaultRoleCounts(n);
    return;
  }
  const min = minWerewolfCount(n);
  const max = maxWerewolfCount(n);
  const werewolf = Math.min(Math.max(room.roleCounts.werewolf, min), max);
  if (werewolf !== room.roleCounts.werewolf) {
    room.roleCounts = { ...room.roleCounts, werewolf };
  }
}
