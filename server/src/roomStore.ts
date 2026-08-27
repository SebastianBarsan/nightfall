import {
  ActionLogEntry,
  ChatMessage,
  DEFAULT_DAY_DURATION_SEC,
  GamePhase,
  GameResult,
  Role,
} from "@nightfall/shared";

export interface Seat {
  socketId: string;
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

  cardArray: Role[] | null;
  originalArray: Role[] | null;
  actionLog: ActionLogEntry[];

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

const CODE_WORDS = [
  "WOLF",
  "MOON",
  "HOWL",
  "DUSK",
  "FANG",
  "LORE",
  "PACK",
  "MIST",
  "RAVEN",
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

export function createRoom(hostSocketId: string, hostName: string): ServerRoom {
  const code = generateRoomCode();
  const room: ServerRoom = {
    code,
    hostSocketId,
    seats: [{ socketId: hostSocketId, name: hostName, connected: true }],
    phase: GamePhase.LOBBY,
    settings: { dayDurationSec: DEFAULT_DAY_DURATION_SEC },
    cardArray: null,
    originalArray: null,
    actionLog: [],
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
