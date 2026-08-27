import type { KeyboardEvent, ReactNode } from "react";
import type { PublicPlayer } from "@nightfall/shared";

const CENTER_CARD_COUNT = 3;
const RX = 44; // horizontal radius, % of container
const RY = 40; // vertical radius, % of container

function TappableCard({
  selectable,
  selected,
  onClick,
}: {
  selectable: boolean;
  selected: boolean;
  onClick?: () => void;
}) {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick?.();
    }
  };
  return (
    <span
      className={`seat-card face-down${selectable ? " selectable" : ""}${selected ? " selected" : ""}`}
      role={selectable ? "button" : undefined}
      tabIndex={selectable ? 0 : undefined}
      onClick={selectable ? onClick : undefined}
      onKeyDown={selectable ? handleKeyDown : undefined}
    />
  );
}

export function Table({
  players,
  hostSocketId,
  mySocketId,
  seatBadge,
  className,
  onSeatClick,
  selectableSeatIds,
  selectedSeatIds,
  onCenterClick,
  selectableCenterIndices,
  selectedCenterIndices,
}: {
  players: PublicPlayer[];
  hostSocketId: string;
  mySocketId: string;
  seatBadge?: (player: PublicPlayer) => ReactNode | null;
  className?: string;
  /** Called when a tappable seat's card is clicked/tapped. */
  onSeatClick?: (player: PublicPlayer) => void;
  /** socketIds whose card should render as tappable. */
  selectableSeatIds?: Set<string>;
  /** socketIds whose card should render as currently chosen (pending confirm). */
  selectedSeatIds?: Set<string>;
  /** Called with the global center-card index (n..n+2) when a center card is tapped. */
  onCenterClick?: (globalIndex: number) => void;
  selectableCenterIndices?: Set<number>;
  selectedCenterIndices?: Set<number>;
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
                  <TappableCard
                    selectable={selectableSeatIds?.has(p.socketId) ?? false}
                    selected={selectedSeatIds?.has(p.socketId) ?? false}
                    onClick={() => onSeatClick?.(p)}
                  />
                  {seatBadge ? <span className="seat-badge">{seatBadge(p)}</span> : null}
                </span>
              </li>
            );
          })}
        </ul>

        <div className="table-center">
          {Array.from({ length: CENTER_CARD_COUNT }, (_, i) => {
            const globalIndex = n + i;
            return (
              <TappableCard
                key={i}
                selectable={selectableCenterIndices?.has(globalIndex) ?? false}
                selected={selectedCenterIndices?.has(globalIndex) ?? false}
                onClick={() => onCenterClick?.(globalIndex)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
