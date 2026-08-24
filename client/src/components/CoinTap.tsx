import { useState } from "react";
import { socket } from "../socket";

/**
 * Flavor "minigame" shown to players who are not the active night actor.
 * Mirrors the spec's SPAWN_COIN / TAP_COIN dummy-traffic pattern: every tap
 * emits a real socket event so idle clients generate the same network
 * chatter as an active player, obscuring who is actually taking a turn.
 */
export function CoinTap({ spawns }: { spawns: number }) {
  const [taps, setTaps] = useState(0);

  const onTap = () => {
    setTaps((t) => t + 1);
    socket.emit("coin:tap");
  };

  return (
    <div className="coin-tap">
      <button className="coin" onClick={onTap} aria-label="Tap the coin">
        🪙
      </button>
      <p className="coin-hint">
        The village sleeps... (taps: {taps}, pings: {spawns})
      </p>
    </div>
  );
}
