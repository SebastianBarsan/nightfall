import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = join(here, "..", "data");
mkdirSync(dataDir, { recursive: true });

export const db = new DatabaseSync(join(dataDir, "nightfall.db"));

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    username_lower TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    games_played INTEGER NOT NULL DEFAULT 0,
    wins INTEGER NOT NULL DEFAULT 0,
    losses INTEGER NOT NULL DEFAULT 0,
    wins_good INTEGER NOT NULL DEFAULT 0,
    wins_evil INTEGER NOT NULL DEFAULT 0,
    wins_jester INTEGER NOT NULL DEFAULT 0,
    vampires_eliminated_as_hunter INTEGER NOT NULL DEFAULT 0,
    hunter_shots_taken INTEGER NOT NULL DEFAULT 0,
    hunter_shots_hit INTEGER NOT NULL DEFAULT 0,
    mvp_count INTEGER NOT NULL DEFAULT 0,
    current_win_streak INTEGER NOT NULL DEFAULT 0,
    longest_win_streak INTEGER NOT NULL DEFAULT 0,
    starting_role_counts TEXT NOT NULL DEFAULT '{}',
    ending_role_counts TEXT NOT NULL DEFAULT '{}'
  )
`);

export interface UserRow {
  id: number;
  username: string;
  username_lower: string;
  password_hash: string;
  password_salt: string;
  created_at: number;
  games_played: number;
  wins: number;
  losses: number;
  wins_good: number;
  wins_evil: number;
  wins_jester: number;
  vampires_eliminated_as_hunter: number;
  hunter_shots_taken: number;
  hunter_shots_hit: number;
  mvp_count: number;
  current_win_streak: number;
  longest_win_streak: number;
  starting_role_counts: string;
  ending_role_counts: string;
}

const insertUserStmt = db.prepare(
  `INSERT INTO users (username, username_lower, password_hash, password_salt, created_at)
   VALUES (?, ?, ?, ?, ?)`,
);
const getUserByUsernameLowerStmt = db.prepare(`SELECT * FROM users WHERE username_lower = ?`);
const getUserByIdStmt = db.prepare(`SELECT * FROM users WHERE id = ?`);
const updateUserStatsStmt = db.prepare(`
  UPDATE users SET
    games_played = ?, wins = ?, losses = ?,
    wins_good = ?, wins_evil = ?, wins_jester = ?,
    vampires_eliminated_as_hunter = ?, hunter_shots_taken = ?, hunter_shots_hit = ?,
    mvp_count = ?, current_win_streak = ?, longest_win_streak = ?,
    starting_role_counts = ?, ending_role_counts = ?
  WHERE id = ?
`);

export function insertUser(username: string, usernameLower: string, passwordHash: string, passwordSalt: string): number {
  const result = insertUserStmt.run(username, usernameLower, passwordHash, passwordSalt, Date.now());
  return Number(result.lastInsertRowid);
}

export function getUserByUsernameLower(usernameLower: string): UserRow | undefined {
  return getUserByUsernameLowerStmt.get(usernameLower) as UserRow | undefined;
}

export function getUserById(id: number): UserRow | undefined {
  return getUserByIdStmt.get(id) as UserRow | undefined;
}

export function updateUserStats(row: UserRow): void {
  updateUserStatsStmt.run(
    row.games_played,
    row.wins,
    row.losses,
    row.wins_good,
    row.wins_evil,
    row.wins_jester,
    row.vampires_eliminated_as_hunter,
    row.hunter_shots_taken,
    row.hunter_shots_hit,
    row.mvp_count,
    row.current_win_streak,
    row.longest_win_streak,
    row.starting_role_counts,
    row.ending_role_counts,
    row.id,
  );
}
