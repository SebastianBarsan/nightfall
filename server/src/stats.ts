import { PlayerStats, Role } from "@nightfall/shared";
import { getUserById, updateUserStats, UserRow } from "./db.js";

const ALL_ROLES = Object.values(Role);

function emptyRoleCounts(): Record<Role, number> {
  const counts = {} as Record<Role, number>;
  for (const role of ALL_ROLES) counts[role] = 0;
  return counts;
}

function parseRoleCounts(json: string): Record<Role, number> {
  const counts = emptyRoleCounts();
  const parsed = JSON.parse(json) as Partial<Record<Role, number>>;
  for (const role of ALL_ROLES) counts[role] = parsed[role] ?? 0;
  return counts;
}

function mostCommonRole(counts: Record<Role, number>): Role | null {
  let best: Role | null = null;
  let bestCount = 0;
  for (const role of ALL_ROLES) {
    if (counts[role] > bestCount) {
      best = role;
      bestCount = counts[role];
    }
  }
  return best;
}

export function toPlayerStats(row: UserRow): PlayerStats {
  const startingRoleCounts = parseRoleCounts(row.starting_role_counts);
  const endingRoleCounts = parseRoleCounts(row.ending_role_counts);
  return {
    username: row.username,
    gamesPlayed: row.games_played,
    wins: row.wins,
    losses: row.losses,
    winsGood: row.wins_good,
    winsEvil: row.wins_evil,
    winsJester: row.wins_jester,
    hunterShotsTaken: row.hunter_shots_taken,
    hunterShotsHit: row.hunter_shots_hit,
    hunterShotAccuracy: row.hunter_shots_taken > 0 ? row.hunter_shots_hit / row.hunter_shots_taken : null,
    mvpCount: row.mvp_count,
    currentWinStreak: row.current_win_streak,
    longestWinStreak: row.longest_win_streak,
    mostCommonStartingRole: mostCommonRole(startingRoleCounts),
    mostCommonEndingRole: mostCommonRole(endingRoleCounts),
    startingRoleCounts,
    endingRoleCounts,
  };
}

export interface GameStatsInput {
  players: { userId: number; originalRole: Role; finalRole: Role; won: boolean }[];
  mvpUserId: number | null;
  hunter: { userId: number; shotTaken: boolean; shotHitWerewolf: boolean } | null;
}

/** Applies one completed game's outcome to every involved account and returns each
 * account's freshly recomputed stats, keyed by userId, for targeted `stats:update` emits. */
export function recordGameStats(input: GameStatsInput): Map<number, PlayerStats> {
  const updated = new Map<number, PlayerStats>();

  for (const player of input.players) {
    const row = getUserById(player.userId);
    if (!row) continue;

    row.games_played += 1;

    const startingCounts = parseRoleCounts(row.starting_role_counts);
    startingCounts[player.originalRole] += 1;
    row.starting_role_counts = JSON.stringify(startingCounts);

    const endingCounts = parseRoleCounts(row.ending_role_counts);
    endingCounts[player.finalRole] += 1;
    row.ending_role_counts = JSON.stringify(endingCounts);

    if (player.won) {
      row.wins += 1;
      row.current_win_streak += 1;
      row.longest_win_streak = Math.max(row.longest_win_streak, row.current_win_streak);
      if (player.finalRole === Role.TANNER) row.wins_jester += 1;
      else if (player.finalRole === Role.WEREWOLF) row.wins_evil += 1;
      else row.wins_good += 1;
    } else {
      row.losses += 1;
      row.current_win_streak = 0;
    }

    if (input.mvpUserId === player.userId) row.mvp_count += 1;

    if (input.hunter?.userId === player.userId) {
      if (input.hunter.shotTaken) {
        row.hunter_shots_taken += 1;
        if (input.hunter.shotHitWerewolf) row.hunter_shots_hit += 1;
      }
    }

    updateUserStats(row);
    updated.set(player.userId, toPlayerStats(row));
  }

  return updated;
}
