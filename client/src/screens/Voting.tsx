import type { RoomSnapshot } from "@nightfall/shared";
import { Countdown } from "../components/Countdown";
import { socket } from "../socket";

export function Voting({ snapshot }: { snapshot: RoomSnapshot }) {
  const mySocketId = socket.id ?? "";
  const iHaveVoted = snapshot.votesCast.includes(mySocketId);

  if (snapshot.phase === "HUNTER_RESOLUTION" && snapshot.hunterSubPhase) {
    const isHunter = snapshot.hunterSubPhase.hunterSocketId === mySocketId;
    return (
      <div className="screen voting">
        <h1>🏹 The Hunter's Last Shot</h1>
        <p className="hint">
          <Countdown endsAt={snapshot.hunterSubPhase.endsAt} />
        </p>
        {isHunter ? (
          <>
            <p>You were eliminated, but as the Hunter you get one final shot. Choose someone to take with you:</p>
            <div className="choice-row">
              {snapshot.players
                .filter((p) => p.socketId !== mySocketId)
                .map((p) => (
                  <button key={p.socketId} onClick={() => socket.emit("hunter:target", { targetSocketId: p.socketId })}>
                    {p.name}
                  </button>
                ))}
            </div>
          </>
        ) : (
          <p>The Hunter is choosing a final target...</p>
        )}
      </div>
    );
  }

  return (
    <div className="screen voting">
      <h1>🗳️ Voting</h1>
      {snapshot.votingEndsAt ? (
        <p className="hint">
          Time remaining: <Countdown endsAt={snapshot.votingEndsAt} />
        </p>
      ) : null}
      <p className="hint">
        Votes cast: {snapshot.votesCast.length} / {snapshot.players.filter((p) => p.connected).length}
      </p>

      {iHaveVoted ? (
        <p>Your vote is in. Waiting for everyone else...</p>
      ) : (
        <div className="choice-row">
          {snapshot.players
            .filter((p) => p.socketId !== mySocketId)
            .map((p) => (
              <button key={p.socketId} onClick={() => socket.emit("vote:cast", { targetSocketId: p.socketId })}>
                {p.name}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
