import { MANDATORY_SINGLE_ROLES, Role, totalCardSlots } from "./roles.js";
import type { RoleCounts } from "./roles.js";

/**
 * Builds and shuffles the hidden card array for a game of N players from the
 * host-chosen role composition. Length is N + 3: indices [0, N) map to player
 * seats, [N, N+3) are center cards. Caller must validate counts first.
 */
export function buildDeck(playerCount: number, roleCounts: RoleCounts): Role[] {
  const deck: Role[] = [
    ...MANDATORY_SINGLE_ROLES,
    ...Array.from({ length: roleCounts.werewolf }, () => Role.WEREWOLF),
    ...Array.from({ length: roleCounts.insomniac }, () => Role.INSOMNIAC),
    ...Array.from({ length: roleCounts.hunter }, () => Role.HUNTER),
    ...Array.from({ length: roleCounts.villager }, () => Role.VILLAGER),
  ];
  const expected = totalCardSlots(playerCount);
  if (deck.length !== expected) {
    throw new Error(`Role counts produce ${deck.length} cards but ${playerCount} players need ${expected}.`);
  }
  shuffleInPlace(deck);
  return deck;
}

export function shuffleInPlace<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
