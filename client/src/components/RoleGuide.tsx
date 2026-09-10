import { Role, roleDisplayName } from "@nightfall/shared";
import { roleColor } from "../roleTheme";

const ROLE_HOWTO: Record<Role, string> = {
  [Role.WEREWOLF]: "Wakes with the other Vampires to see who else is one. Alone, may peek at a center card. Wins if no Vampire is voted out.",
  [Role.SEER]: "May look at another player's card, or two of the center cards.",
  [Role.ROBBER]: "May swap their card with another player's, then looks at their new card. Now plays as that role.",
  [Role.TROUBLEMAKER]: "May swap two other players' cards without looking at either.",
  [Role.INSOMNIAC]: "At the end of the night, may check their own card to see if it changed.",
  [Role.HUNTER]: "If voted out, immediately takes one other player down too.",
  [Role.TANNER]: "Wins alone if voted out; everyone else loses.",
  [Role.VILLAGER]: "No night action. Vote wisely by day.",
};

const ROLE_ORDER = Object.values(Role);

export function RoleGuide({ visible, onToggle }: { visible: boolean; onToggle: () => void }) {
  if (!visible) {
    return (
      <button className="role-guide-reopen" onClick={onToggle}>
        How to Play
      </button>
    );
  }

  return (
    <div className="role-guide-panel panel">
      <div className="role-guide-header">
        <span className="role-guide-title">How to Play</span>
        <button className="link-button" onClick={onToggle}>
          Hide
        </button>
      </div>

      <div className="role-guide-body">
        {ROLE_ORDER.map((role) => {
          const isVampire = role === Role.WEREWOLF;
          return (
            <div className="role-guide-entry" key={role}>
              <h4 className={`role-guide-name ${isVampire ? "role-guide-name--scary" : "role-guide-name--whimsy"}`} style={{ color: roleColor(role) }}>
                {roleDisplayName(role)}
              </h4>
              <p className="role-guide-desc">{ROLE_HOWTO[role]}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
