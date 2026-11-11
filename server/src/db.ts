import { createClient, type InValue } from "@libsql/client";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// In production, point TURSO_DATABASE_URL (+ TURSO_AUTH_TOKEN) at a hosted Turso
// database so data survives restarts on hosts without a persistent disk. Without
// it, fall back to a local SQLite file for development.
function localDbUrl(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const dataDir = join(here, "..", "data");
  mkdirSync(dataDir, { recursive: true });
  return pathToFileURL(join(dataDir, "nightfall.db")).href;
}

export const db = createClient({
  url: process.env.TURSO_DATABASE_URL || localDbUrl(),
  authToken: process.env.TURSO_AUTH_TOKEN,
});

await db.execute(`
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

const UPDATE_USER_STATS_SQL = `
  UPDATE users SET
    games_played = ?, wins = ?, losses = ?,
    wins_good = ?, wins_evil = ?, wins_jester = ?,
    vampires_eliminated_as_hunter = ?, hunter_shots_taken = ?, hunter_shots_hit = ?,
    mvp_count = ?, current_win_streak = ?, longest_win_streak = ?,
    starting_role_counts = ?, ending_role_counts = ?
  WHERE id = ?
`;

async function getOne(sql: string, args: InValue[]): Promise<UserRow | undefined> {
  const result = await db.execute({ sql, args });
  return result.rows[0] as unknown as UserRow | undefined;
}

export async function insertUser(
  username: string,
  usernameLower: string,
  passwordHash: string,
  passwordSalt: string,
): Promise<number> {
  const result = await db.execute({
    sql: `INSERT INTO users (username, username_lower, password_hash, password_salt, created_at)
          VALUES (?, ?, ?, ?, ?)`,
    args: [username, usernameLower, passwordHash, passwordSalt, Date.now()],
  });
  return Number(result.lastInsertRowid);
}

export function getUserByUsernameLower(usernameLower: string): Promise<UserRow | undefined> {
  return getOne(`SELECT * FROM users WHERE username_lower = ?`, [usernameLower]);
}

export function getUserById(id: number): Promise<UserRow | undefined> {
  return getOne(`SELECT * FROM users WHERE id = ?`, [id]);
}

export async function updateUserStats(row: UserRow): Promise<void> {
  await db.execute({
    sql: UPDATE_USER_STATS_SQL,
    args: [
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
    ],
  });
}
