import type { RoomSnapshot } from "@nightfall/shared";
import { Countdown } from "../components/Countdown";
import { Table } from "../components/Table";
import { socket } from "../socket";

export function Voting({ snapshot }: { snapshot: RoomSnapshot }) {
  const mySocketId = socket.id ?? "";
  const iHaveVoted = snapshot.votesCast.includes(mySocketId);

  if (snapshot.phase === "HUNTER_RESOLUTION" && snapshot.hunterSubPhase) {
    const isHunter = snapshot.hunterSubPhase.hunterSocketId === mySocketId;
    const selectableSeatIds = isHunter
      ? new Set(snapshot.players.filter((p) => p.socketId !== mySocketId).map((p) => p.socketId))
      : undefined;
    return (
      <div className="screen voting">
        <h1>The Hunter's Last Shot</h1>
        <p className="hint">
          <Countdown endsAt={snapshot.hunterSubPhase.endsAt} />
        </p>
        <Table
          players={snapshot.players}
          hostSocketId={snapshot.hostSocketId}
          mySocketId={mySocketId}
          onSeatClick={isHunter ? (p) => socket.emit("hunter:target", { targetSocketId: p.socketId }) : undefined}
          selectableSeatIds={selectableSeatIds}
        />
        {isHunter ? (
          <p>You were eliminated, but as the Hunter you get one final shot. Tap someone to take with you.</p>
        ) : (
          <p>The Hunter is choosing a final target...</p>
        )}
      </div>
    );
  }

  return (
    <div className="screen voting">
      <h1>Voting</h1>
      {snapshot.votingEndsAt ? (
        <p className="hint">
          Time remaining: <Countdown endsAt={snapshot.votingEndsAt} />
        </p>
      ) : null}
      <p className="hint">
        Votes cast: {snapshot.votesCast.length} / {snapshot.players.filter((p) => p.connected).length}
      </p>

      <Table
        players={snapshot.players}
        hostSocketId={snapshot.hostSocketId}
        mySocketId={mySocketId}
        seatBadge={(p) => (snapshot.votesCast.includes(p.socketId) ? <span title="Voted">✓</span> : null)}
        onSeatClick={!iHaveVoted ? (p) => socket.emit("vote:cast", { targetSocketId: p.socketId }) : undefined}
        selectableSeatIds={
          !iHaveVoted
            ? new Set(snapshot.players.filter((p) => p.socketId !== mySocketId).map((p) => p.socketId))
            : undefined
        }
      />

      {iHaveVoted ? (
        <p>Your vote is in. Waiting for everyone else...</p>
      ) : (
        <p className="hint">Tap a player's card to cast your vote.</p>
      )}
    </div>
  );
}
