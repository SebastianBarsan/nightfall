import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { MAX_NAME_LENGTH, MIN_PASSWORD_LENGTH, MIN_USERNAME_LENGTH, USERNAME_PATTERN } from "@nightfall/shared";
import { getUserById, getUserByUsernameLower, insertUser, UserRow } from "./db.js";
import { toPlayerStats } from "./stats.js";

export interface AuthedUser {
  id: number;
  username: string;
}

function hashPassword(password: string): { hash: string; salt: string } {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return { hash, salt };
}

function verifyPassword(password: string, salt: string, hash: string): boolean {
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

function validUsername(username: string): string | null {
  const trimmed = username.trim().slice(0, MAX_NAME_LENGTH);
  if (trimmed.length < MIN_USERNAME_LENGTH) return null;
  if (!USERNAME_PATTERN.test(trimmed)) return null;
  return trimmed;
}

function toAuthedUser(row: UserRow): AuthedUser {
  return { id: row.id, username: row.username };
}

export async function registerUser(
  username: string,
  password: string,
): Promise<{ ok: true; user: AuthedUser } | { ok: false; error: string }> {
  const cleanUsername = validUsername(username);
  if (!cleanUsername) {
    return { ok: false, error: `Username must be ${MIN_USERNAME_LENGTH}-${MAX_NAME_LENGTH} letters, digits, - or _.` };
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` };
  }
  const usernameLower = cleanUsername.toLowerCase();
  if (await getUserByUsernameLower(usernameLower)) {
    return { ok: false, error: "Username already taken." };
  }
  const { hash, salt } = hashPassword(password);
  try {
    const id = await insertUser(cleanUsername, usernameLower, hash, salt);
    return { ok: true, user: { id, username: cleanUsername } };
  } catch (err) {
    if (err instanceof Error && err.message.includes("UNIQUE constraint")) {
      return { ok: false, error: "Username already taken." };
    }
    throw err;
  }
}

export async function loginUser(
  username: string,
  password: string,
): Promise<{ ok: true; user: AuthedUser } | { ok: false; error: "NOT_FOUND" | "WRONG_PASSWORD" | "SERVER_ERROR" }> {
  const row = await getUserByUsernameLower(username.trim().toLowerCase());
  if (!row) return { ok: false, error: "NOT_FOUND" };
  if (!verifyPassword(password, row.password_salt, row.password_hash)) {
    return { ok: false, error: "WRONG_PASSWORD" };
  }
  return { ok: true, user: toAuthedUser(row) };
}

export async function statsForUser(userId: number) {
  const row = await getUserById(userId);
  if (!row) return null;
  return toPlayerStats(row);
}

// In-memory only — sessions reset on server restart, matching the rest of this
// prototype's "everything resets" ethos. Only the database stats data is durable.
const sessions = new Map<string, AuthedUser>();

export function createSession(user: AuthedUser): string {
  const token = randomBytes(24).toString("hex");
  sessions.set(token, user);
  return token;
}

export function resumeSession(token: string): AuthedUser | null {
  return sessions.get(token) ?? null;
}

export function destroySession(token: string): void {
  sessions.delete(token);
}
