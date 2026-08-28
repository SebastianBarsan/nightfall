import { Role, roleDisplayName as sharedRoleDisplayName } from "@nightfall/shared";

export const roleDisplayName = sharedRoleDisplayName;

/** Accent color per role, used for the reveal screen, badges, and role list. */
export const ROLE_COLOR: Record<Role, string> = {
  [Role.WEREWOLF]: "#ff4d4d",
  [Role.SEER]: "#5bd97a",
  [Role.ROBBER]: "#a06bff",
  [Role.TROUBLEMAKER]: "#ff9d4d",
  [Role.INSOMNIAC]: "#4fd6d0",
  [Role.HUNTER]: "#e8b23d",
  [Role.TANNER]: "#ff6fc7",
  [Role.VILLAGER]: "#5a9bff",
};

export function roleColor(role: Role): string {
  return ROLE_COLOR[role];
}

export const FACTION_DISPLAY_NAME: Record<string, string> = {
  VILLAGE: "Mortals",
  WEREWOLF: "Vampires",
  TANNER: "Jester",
};

export function factionDisplayName(faction: string): string {
  return FACTION_DISPLAY_NAME[faction] ?? faction;
}
