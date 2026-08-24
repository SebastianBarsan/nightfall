import { MAX_PLAYERS, MIN_PLAYERS, type RoomSnapshot } from "@nightfall/shared";
import { PlayerList } from "../components/PlayerList";
import { socket } from "../socket";

export function Lobby({ snapshot }: { snapshot: RoomSnapshot }) {
  const isHost = snapshot.hostSocketId === socket.id;
  const count = snapshot.players.length;
  const canStart = count >= MIN_PLAYERS && count <= MAX_PLAYERS;

  return (
    <div className="screen lobby">
      <h1>Lobby</h1>
      <div className="room-code">
        Room code: <span>{snapshot.code}</span>
      </div>
      <p className="hint">Share this code with the other players.</p>

      <PlayerList players={snapshot.players} hostSocketId={snapshot.hostSocketId} mySocketId={socket.id ?? ""} />

      <p className="hint">
        {count} / {MAX_PLAYERS} players ({MIN_PLAYERS}-{MAX_PLAYERS} required)
      </p>

      {isHost ? (
        <button disabled={!canStart} onClick={() => socket.emit("room:start")}>
          Start Game
        </button>
      ) : (
        <p className="hint">Waiting for the host to start the game...</p>
      )}
    </div>
  );
}
