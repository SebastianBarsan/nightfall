import type { CSSProperties, ReactNode } from "react";
import type { PublicPlayer } from "@nightfall/shared";

const CENTER_CARD_COUNT = 3;
const RX = 44; // horizontal radius, % of container
const RY = 40; // vertical radius, % of container

export function Table({
  players,
  hostSocketId,
  mySocketId,
  seatBadge,
  className,
}: {
  players: PublicPlayer[];
  hostSocketId: string;
  mySocketId: string;
  seatBadge?: (player: PublicPlayer) => ReactNode | null;
  className?: string;
}) {
  const n = players.length;
  const myIndex = Math.max(
    0,
    players.findIndex((p) => p.socketId === mySocketId),
  );
  const ordered = n > 0 ? Array.from({ length: n }, (_, i) => players[(myIndex + i) % n]) : [];

  return (
    <div className={`table${className ? ` ${className}` : ""}`}>
      <div className="table-surface">
        <ul className="table-seats">
          {ordered.map((p, i) => {
            const angle = Math.PI / 2 + i * ((2 * Math.PI) / n);
            const x = 50 + RX * Math.cos(angle);
            const y = 50 + RY * Math.sin(angle);
            const isMe = p.socketId === mySocketId;
            const isHost = p.socketId === hostSocketId;
            return (
              <li
                key={p.socketId}
                className={`table-seat${isMe ? " table-seat--me" : ""}${p.connected ? "" : " disconnected"}`}
                style={{ left: `${x}%`, top: `${y}%` }}
              >
                <span className="seat-label">
                  {p.name}
                  {isMe ? " (you)" : ""}
                  {isHost ? " ★" : ""}
                  {!p.connected ? " (disconnected)" : ""}
                </span>
                <span className="seat-card-wrap">
                  <span className="seat-card face-down" />
                  {seatBadge ? <span className="seat-badge">{seatBadge(p)}</span> : null}
                </span>
              </li>
            );
          })}
        </ul>

        <div className="table-center">
          {Array.from({ length: CENTER_CARD_COUNT }, (_, i) => (
            <span key={i} className="seat-card face-down" style={{ "--fan": i - 1 } as CSSProperties} />
          ))}
        </div>
      </div>
    </div>
  );
}
