import { useEffect, useState } from "react";
import { Role } from "@nightfall/shared";
import { roleColor, roleDisplayName } from "../roleTheme";

export function RoleReveal({ role, onDone }: { role: Role; onDone: () => void }) {
  const [stage, setStage] = useState<"dark" | "reveal">("dark");
  const isVampire = role === Role.WEREWOLF;

  useEffect(() => {
    const t = setTimeout(() => setStage("reveal"), 300);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      className={`role-reveal role-reveal--${stage}`}
      onClick={() => (stage === "reveal" ? onDone() : undefined)}
      role="button"
      tabIndex={0}
      aria-label={stage === "reveal" ? "Dismiss role reveal" : undefined}
    >
      <div className="role-reveal-glow" style={{ background: roleColor(role) }} />
      {stage === "reveal" ? (
        <div className="role-reveal-content">
          <p className="role-reveal-kicker">You are the</p>
          <h1
            className={`role-reveal-name ${isVampire ? "role-reveal-name--scary" : "role-reveal-name--whimsy"}`}
            style={{ color: roleColor(role) }}
          >
            {roleDisplayName(role)}
          </h1>
          <p className="role-reveal-tap">tap to continue</p>
        </div>
      ) : null}
    </div>
  );
}
