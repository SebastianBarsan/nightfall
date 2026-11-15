import type { Role, RoleCounts } from "./roles.js";

export const GamePhase = {
  LOBBY: "LOBBY",
  NIGHT: "NIGHT",
  DAY: "DAY",
  VOTING: "VOTING",
  HUNTER_RESOLUTION: "HUNTER_RESOLUTION",
  REVEAL: "REVEAL",
} as const;
export type GamePhase = (typeof GamePhase)[keyof typeof GamePhase];

export interface PublicPlayer {
  socketId: string;
  name: string;
  connected: boolean;
  seatIndex: number;
}

export interface ChatMessage {
  socketId: string;
  name: string;
  text: string;
  timestamp: number;
}

export interface ActionLogEntry {
  role: Role;
  actorSocketId: string | null;
  actorName: string | null;
  description: string;
  timestamp: number;
}

export interface PlayerResult {
  socketId: string;
  name: string;
  originalRole: Role;
  finalRole: Role;
  eliminated: boolean;
  won: boolean;
}

export interface GameResult {
  initialArray: Role[];
  finalArray: Role[];
  actionLog: ActionLogEntry[];
  eliminatedSocketIds: string[];
  winningFactions: ("VILLAGE" | "WEREWOLF" | "TANNER")[];
  players: PlayerResult[];
  mvp: { socketId: string; name: string; reason: string } | null;
}

/** Per-account stats, persisted server-side and pushed to that account's own client only. */
export interface PlayerStats {
  username: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
  winsGood: number;
  winsEvil: number;
  winsJester: number;
  hunterShotsTaken: number;
  /** Times a Hunter's shot hit a Vampire — i.e. "vampires eliminated as Hunter." */
  hunterShotsHit: number;
  hunterShotAccuracy: number | null;
  mvpCount: number;
  currentWinStreak: number;
  longestWinStreak: number;
  mostCommonStartingRole: Role | null;
  mostCommonEndingRole: Role | null;
  startingRoleCounts: Record<Role, number>;
  endingRoleCounts: Record<Role, number>;
}

/** Sanitized room snapshot broadcast to every client — never contains hidden card values. */
export interface RoomSnapshot {
  code: string;
  hostSocketId: string;
  phase: GamePhase;
  players: PublicPlayer[];
  settings: { dayDurationSec: number };
  roleCounts: RoleCounts;
  dayEndsAt: number | null;
  votingEndsAt: number | null;
  hunterSubPhase: { hunterSocketId: string; endsAt: number } | null;
  /** Which role is currently acting and when its turn ends. Never reveals *who* holds the role. */
  nightStep: { role: Role; endsAt: number } | null;
  votesCast: string[]; // socketIds who have voted, not who they voted for
  chat: ChatMessage[];
  result: GameResult | null;
}

export const MIN_NAME_LENGTH = 1;
export const MAX_NAME_LENGTH = 20;
export const MIN_USERNAME_LENGTH = 3;
export const MIN_PASSWORD_LENGTH = 4;
export const MAX_PASSWORD_LENGTH = 128;
/** Letters, digits, underscore, hyphen only — keeps seat labels readable. */
export const USERNAME_PATTERN = /^[A-Za-z0-9_-]+$/;
export const DEFAULT_DAY_DURATION_SEC = 30;
/** Pause after dealing, before the first night step starts, so players have time to read their
 * role reveal and dismiss it before any turn timer starts counting down. */
export const ROLE_REVEAL_DELAY_MS = 5_000;
export const NIGHT_STEP_DURATION_MS = 8_000;
export const HUNTER_SUBPHASE_DURATION_MS = 10_000;
export const VOTING_DURATION_MS = 15_000;
