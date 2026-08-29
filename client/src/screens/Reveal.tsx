import { useState } from "react";
import type { RoomSnapshot } from "@nightfall/shared";
import { socket } from "../socket";
import { factionDisplayName, roleDisplayName } from "../roleTheme";

export function Reveal({ snapshot }: { snapshot: RoomSnapshot }) {
  const [showLog, setShowLog] = useState(false);
  const result = snapshot.result;
  const isHost = snapshot.hostSocketId === socket.id;
  if (!result) return null;

  const iWon = result.players.find((p) => p.socketId === socket.id)?.won;

  return (
    <div className="screen reveal">
      <h1>Reveal</h1>
      <p className={`banner ${iWon ? "win" : "lose"}`}>
        {result.winningFactions.length === 0
          ? "No faction wins this round."
          : `Winning faction(s): ${result.winningFactions.map(factionDisplayName).join(", ")}`}
        {" — "}
        {iWon ? "You won!" : "You lost."}
      </p>

      {result.mvp ? (
        <p className="hint">
          MVP: <strong>{result.mvp.name}</strong> — {result.mvp.reason}
        </p>
      ) : null}

      <table className="results-table">
        <thead>
          <tr>
            <th>Player</th>
            <th>Started as</th>
            <th>Ended as</th>
            <th>Eliminated</th>
            <th>Result</th>
          </tr>
        </thead>
        <tbody>
          {result.players.map((p) => (
            <tr key={p.socketId} className={p.socketId === socket.id ? "me" : ""}>
              <td>{p.name}</td>
              <td>{roleDisplayName(p.originalRole)}</td>
              <td>{roleDisplayName(p.finalRole)}</td>
              <td>{p.eliminated ? "Yes" : "No"}</td>
              <td>{p.won ? "Won" : "Lost"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <button className="link-button" onClick={() => setShowLog((v) => !v)}>
        {showLog ? "Hide" : "Show"} full night log
      </button>
      {showLog ? (
        <pre className="log">{JSON.stringify(result.actionLog, null, 2)}</pre>
      ) : null}

      {isHost ? (
        <button onClick={() => socket.emit("room:playAgain")}>Play Again</button>
      ) : (
        <p className="hint">Waiting for the host to start a new round...</p>
      )}
    </div>
  );
}
