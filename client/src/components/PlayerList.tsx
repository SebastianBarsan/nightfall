import type { ReactNode } from "react";
import type { PublicPlayer } from "@nightfall/shared";

export function PlayerList({
  players,
  hostSocketId,
  mySocketId,
  renderAction,
}: {
  players: PublicPlayer[];
  hostSocketId: string;
  mySocketId: string;
  renderAction?: (player: PublicPlayer) => ReactNode;
}) {
  return (
    <ul className="player-list">
      {players.map((p) => (
        <li key={p.socketId} className={`player-row ${p.connected ? "" : "disconnected"}`}>
          <span className="player-name">
            {p.name}
            {p.socketId === mySocketId ? " (you)" : ""}
            {p.socketId === hostSocketId ? " ★" : ""}
            {!p.connected ? " (disconnected)" : ""}
          </span>
          {renderAction ? <span className="player-action">{renderAction(p)}</span> : null}
        </li>
      ))}
    </ul>
  );
}
