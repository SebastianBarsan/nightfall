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

// Fixed 8-card special role set from the spec (2 Werewolf, 1 each of the rest).
// The array dealt each game is N + 3 cards long (N players + 3 center cards).
// Since the special set alone is 8 cards, at least 5 players are required for
// every special role to fit alongside the 3 center cards (5 + 3 = 8). Below
// that, "N-3 Villagers" as written in the spec would produce more cards than
// slots, so this implementation enforces 5 <= N <= 10 rather than 3 <= N <= 10.
export const FIXED_ROLE_SET: Role[] = [
  Role.WEREWOLF,
  Role.WEREWOLF,
  Role.SEER,
  Role.ROBBER,
  Role.TROUBLEMAKER,
  Role.INSOMNIAC,
  Role.HUNTER,
  Role.TANNER,
];

export const MIN_PLAYERS = 5;
export const MAX_PLAYERS = 10;
export const CENTER_CARD_COUNT = 3;

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
