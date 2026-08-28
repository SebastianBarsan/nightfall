import type { ReactNode } from "react";
import { VillageSkyline } from "./VillageSkyline";

/** Full-bleed atmospheric banner behind the Night/Day screen headers — same village/castle
 * skyline both times, recolored and lit differently per variant. */
export function GameScene({ variant, children }: { variant: "night" | "day"; children: ReactNode }) {
  return (
    <div className={`game-scene game-scene--${variant}`}>
      {variant === "night" ? (
        <>
          <div className="moon" />
          <div className="fog" />
          <div className="fireflies" aria-hidden="true">
            {Array.from({ length: 4 }, (_, i) => (
              <span key={i} className={`firefly firefly-${i}`} />
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="sun" />
          <div className="clouds" aria-hidden="true">
            <span className="cloud cloud-0" />
            <span className="cloud cloud-1" />
            <span className="cloud cloud-2" />
          </div>
        </>
      )}
      <VillageSkyline />
      <div className="game-scene-content">{children}</div>
    </div>
  );
}
