export const Role = {
  WEREWOLF: "WEREWOLF",
  SEER: "SEER",
  ROBBER: "ROBBER",
  TROUBLEMAKER: "TROUBLEMAKER",
  INSOMNIAC: "INSOMNIAC",
  HUNTER: "HUNTER",
  TANNER: "TANNER",
  VILLAGER: "VILLAGER",
} as const;

export type Role = (typeof Role)[keyof typeof Role];

/** Player-facing name for each role. Internal Role identifiers stay as-is everywhere else —
 * this is the single place that maps them to the current theme's flavor names. */
export const ROLE_DISPLAY_NAME: Record<Role, string> = {
  [Role.WEREWOLF]: "Vampire",
  [Role.SEER]: "Oracle",
  [Role.ROBBER]: "Thief",
  [Role.TROUBLEMAKER]: "Troublemaker",
  [Role.INSOMNIAC]: "Sentry",
  [Role.HUNTER]: "Hunter",
  [Role.TANNER]: "Jester",
  [Role.VILLAGER]: "Mortal",
};

export function roleDisplayName(role: Role): string {
  return ROLE_DISPLAY_NAME[role];
}

export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 10;
export const CENTER_CARD_COUNT = 3;

// Always exactly one of each of these — the host cannot remove or add extra copies.
export const MANDATORY_SINGLE_ROLES: Role[] = [Role.SEER, Role.ROBBER, Role.TROUBLEMAKER, Role.TANNER];

/** Host-configurable role composition for a game. Seer/Robber/Troublemaker/Tanner are always 1 each and not included here. */
export interface RoleCounts {
  werewolf: number;
  insomniac: number; // 0 or 1
  hunter: number; // 0 or 1
  villager: number;
}

export function totalCardSlots(playerCount: number): number {
  return playerCount + CENTER_CARD_COUNT;
}

export function minWerewolfCount(playerCount: number): number {
  return playerCount >= 5 ? 2 : 1;
}

export function maxWerewolfCount(playerCount: number): number {
  return Math.max(minWerewolfCount(playerCount), Math.floor(playerCount / 2));
}

/** A valid starting configuration for the given player count: minimum Werewolves, no Insomniac/Hunter, rest Villagers. */
export function defaultRoleCounts(playerCount: number): RoleCounts {
  const werewolf = minWerewolfCount(playerCount);
  const used = MANDATORY_SINGLE_ROLES.length + werewolf;
  const villager = Math.max(0, totalCardSlots(playerCount) - used);
  return { werewolf, insomniac: 0, hunter: 0, villager };
}

export function roleCountsTotal(counts: RoleCounts): number {
  return MANDATORY_SINGLE_ROLES.length + counts.werewolf + counts.insomniac + counts.hunter + counts.villager;
}

/** Returns a human-readable problem with the counts for this player count, or null if valid. */
export function validateRoleCounts(playerCount: number, counts: RoleCounts): string | null {
  const min = minWerewolfCount(playerCount);
  const max = maxWerewolfCount(playerCount);
  if (!Number.isInteger(counts.werewolf) || counts.werewolf < min) {
    return `At least ${min} Werewolf${min > 1 ? "ves" : ""} required for ${playerCount} players.`;
  }
  if (counts.werewolf > max) {
    return `At most ${max} Werewolves allowed for ${playerCount} players.`;
  }
  if (counts.insomniac !== 0 && counts.insomniac !== 1) return "Insomniac must be included 0 or 1 times.";
  if (counts.hunter !== 0 && counts.hunter !== 1) return "Hunter must be included 0 or 1 times.";
  if (!Number.isInteger(counts.villager) || counts.villager < 0) return "Villager count cannot be negative.";
  const total = roleCountsTotal(counts);
  const expected = totalCardSlots(playerCount);
  if (total !== expected) {
    return `Role counts add up to ${total}, but ${playerCount} players need exactly ${expected}.`;
  }
  return null;
}

export const WEREWOLF_TEAM = new Set<Role>([Role.WEREWOLF]);
export const TANNER_TEAM = new Set<Role>([Role.TANNER]);
// Everyone not a Werewolf or Tanner is on the Village team, including Hunter.
export function isVillageTeam(role: Role): boolean {
  return !WEREWOLF_TEAM.has(role) && !TANNER_TEAM.has(role);
}

// Sequential night action execution order (roles without a card in play,
// or whose card ended up only in the center, are skipped automatically).
export const NIGHT_ORDER: Role[] = [
  Role.WEREWOLF,
  Role.SEER,
  Role.ROBBER,
  Role.TROUBLEMAKER,
  Role.INSOMNIAC,
];
