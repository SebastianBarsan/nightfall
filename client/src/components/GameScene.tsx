import type { ReactNode } from "react";
import { VillageSkyline } from "./VillageSkyline";
import { FarmScenery } from "./FarmScenery";

/** Fixed, full-viewport atmospheric backdrop behind the whole Night/Day screen — including the
 * table below the header — rather than a banner confined to the top. Night keeps the village/
 * castle skyline; day uses a separate self-colored farm scene (see FarmScenery) rather than a
 * recolor of the same silhouette. Kept subtle (low opacity, tuned per variant in App.css) so it
 * reads as ambience, not competition for the table/UI in front of it. */
export function GameScene({ variant, children }: { variant: "night" | "day"; children: ReactNode }) {
  return (
    <>
      <div className={`game-scene-bg game-scene-bg--${variant}`} aria-hidden="true">
        {variant === "night" ? (
          <>
            <div className="moon" />
            <div className="fog" />
            <div className="fireflies">
              {Array.from({ length: 4 }, (_, i) => (
                <span key={i} className={`firefly firefly-${i}`} />
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="sun" />
            <div className="clouds">
              <span className="cloud cloud-0" />
              <span className="cloud cloud-1" />
              <span className="cloud cloud-2" />
            </div>
          </>
        )}
        {variant === "night" ? <VillageSkyline /> : <FarmScenery />}
      </div>
      <div className="game-scene-content">{children}</div>
    </>
  );
}
