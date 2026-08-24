import { CENTER_CARD_COUNT, FIXED_ROLE_SET, Role } from "./roles.js";

/**
 * Builds and shuffles the hidden card array for a game of N players.
 * Length is N + 3: indices [0, N) map to player seats, [N, N+3) are center cards.
 */
export function buildDeck(playerCount: number): Role[] {
  const totalCards = playerCount + CENTER_CARD_COUNT;
  const villagerCount = totalCards - FIXED_ROLE_SET.length;
  if (villagerCount < 0) {
    throw new Error(
      `Cannot build a deck for ${playerCount} players: the fixed role set needs ` +
        `${FIXED_ROLE_SET.length} slots but only ${totalCards} are available.`,
    );
  }
  const deck: Role[] = [
    ...FIXED_ROLE_SET,
    ...Array.from({ length: villagerCount }, () => Role.VILLAGER),
  ];
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
