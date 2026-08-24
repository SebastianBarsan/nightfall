import { useState } from "react";
import type { RoomSnapshot } from "@nightfall/shared";
import { CoinTap } from "../components/CoinTap";
import { Table } from "../components/Table";
import { socket } from "../socket";
import type { GameUiState } from "../useGame";

export function Night({ snapshot, ui }: { snapshot: RoomSnapshot; ui: GameUiState }) {
  const mySeat = snapshot.players.findIndex((p) => p.socketId === socket.id);
  const n = snapshot.players.length;
  const centerSeats = [n, n + 1, n + 2];
  const others = snapshot.players.filter((p) => p.socketId !== socket.id);

  return (
    <div className="screen night">
      <h1>🌑 Night</h1>
      {ui.myRole ? (
        <p className="role-badge">
          Your role: <strong>{ui.myRole}</strong>
        </p>
      ) : null}

      <Table
        players={snapshot.players}
        hostSocketId={snapshot.hostSocketId}
        mySocketId={socket.id ?? ""}
        seatBadge={(p) => (ui.fellowWolves?.includes(p.socketId) ? <span title="Fellow Werewolf">🐺</span> : null)}
      />

      {ui.fellowWolves ? (
        <div className="panel">
          <h2>Fellow Werewolves</h2>
          {ui.fellowWolves.length === 0 ? (
            <p>You are the only Werewolf among the players.</p>
          ) : (
            <ul>
              {ui.fellowWolves.map((id) => (
                <li key={id}>{snapshot.players.find((p) => p.socketId === id)?.name ?? "?"}</li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {ui.centerPromptIndices && !ui.centerResult ? (
        <WerewolfCenterPrompt indices={ui.centerPromptIndices} baseIndex={n} />
      ) : null}
      {ui.centerResult ? (
        <div className="panel">
          <h2>Center Card Revealed</h2>
          <p>
            Center card {ui.centerResult.centerIndex - n + 1}: <strong>{ui.centerResult.role}</strong>
          </p>
        </div>
      ) : null}

      {ui.seerPromptActive ? <SeerPrompt others={others} centerSeats={centerSeats} /> : null}
      {ui.seerResult ? (
        <div className="panel">
          <h2>Vision</h2>
          {ui.seerResult.viewedPlayerSeat !== null ? (
            <p>
              {snapshot.players[ui.seerResult.viewedPlayerSeat]?.name}'s card:{" "}
              <strong>{ui.seerResult.roles[0]}</strong>
            </p>
          ) : (
            <p>
              Center cards: <strong>{ui.seerResult.roles.join(", ")}</strong>
            </p>
          )}
        </div>
      ) : null}

      {ui.robberPromptActive ? <RobberPrompt others={others} /> : null}
      {ui.robberResult ? (
        <div className="panel">
          <h2>You Robbed a Card</h2>
          <p>
            Your new role: <strong>{ui.robberResult.newRole}</strong>
          </p>
        </div>
      ) : null}

      {ui.troublemakerPromptActive ? <TroublemakerPrompt others={others} /> : null}
      {ui.troublemakerAcked ? (
        <div className="panel">
          <h2>Cards Swapped</h2>
          <p>You swapped two players' cards. You don't know what they became.</p>
        </div>
      ) : null}

      {ui.insomniacResult ? (
        <div className="panel">
          <h2>Insomniac Check</h2>
          <p>
            Your current card is now: <strong>{ui.insomniacResult.currentRole}</strong>
          </p>
        </div>
      ) : null}

      {!ui.fellowWolves &&
      !ui.centerPromptIndices &&
      !ui.centerResult &&
      !ui.seerPromptActive &&
      !ui.robberPromptActive &&
      !ui.troublemakerPromptActive ? (
        <CoinTap spawns={ui.coinSpawns} />
      ) : null}

      <p className="hint">Mine: seat {mySeat}</p>
    </div>
  );
}

function WerewolfCenterPrompt({ indices, baseIndex }: { indices: number[]; baseIndex: number }) {
  return (
    <div className="panel">
      <h2>Lone Wolf</h2>
      <p>No other player is a Werewolf. Peek at a center card:</p>
      <div className="choice-row">
        {indices.map((idx) => (
          <button key={idx} onClick={() => socket.emit("night:werewolf:viewCenter", { centerIndex: idx })}>
            Center {idx - baseIndex + 1}
          </button>
        ))}
      </div>
    </div>
  );
}

function SeerPrompt({
  others,
  centerSeats,
}: {
  others: RoomSnapshot["players"];
  centerSeats: number[];
}) {
  const [mode, setMode] = useState<"player" | "center">("player");
  const [selectedCenters, setSelectedCenters] = useState<number[]>([]);

  const toggleCenter = (seat: number) => {
    setSelectedCenters((cur) =>
      cur.includes(seat) ? cur.filter((c) => c !== seat) : cur.length < 2 ? [...cur, seat] : cur,
    );
  };

  const submitPlayer = (seat: number) => {
    socket.emit("night:seer:target", { playerSeat: seat, centerIndices: null });
  };

  const submitCenters = () => {
    if (selectedCenters.length !== 2) return;
    socket.emit("night:seer:target", { playerSeat: null, centerIndices: selectedCenters });
  };

  return (
    <div className="panel">
      <h2>Seer</h2>
      <div className="choice-row">
        <button className={mode === "player" ? "active" : ""} onClick={() => setMode("player")}>
          View a player
        </button>
        <button className={mode === "center" ? "active" : ""} onClick={() => setMode("center")}>
          View two center cards
        </button>
      </div>

      {mode === "player" ? (
        <div className="choice-row">
          {others.map((p) => (
            <button key={p.socketId} onClick={() => submitPlayer(p.seatIndex)}>
              {p.name}
            </button>
          ))}
        </div>
      ) : (
        <>
          <div className="choice-row">
            {centerSeats.map((seat, i) => (
              <button
                key={seat}
                className={selectedCenters.includes(seat) ? "active" : ""}
                onClick={() => toggleCenter(seat)}
              >
                Center {i + 1}
              </button>
            ))}
          </div>
          <button disabled={selectedCenters.length !== 2} onClick={submitCenters}>
            Confirm
          </button>
        </>
      )}
    </div>
  );
}

function RobberPrompt({ others }: { others: RoomSnapshot["players"] }) {
  return (
    <div className="panel">
      <h2>Robber</h2>
      <p>Swap your card with another player's:</p>
      <div className="choice-row">
        {others.map((p) => (
          <button key={p.socketId} onClick={() => socket.emit("night:robber:target", { playerSeat: p.seatIndex })}>
            {p.name}
          </button>
        ))}
      </div>
    </div>
  );
}

function TroublemakerPrompt({ others }: { others: RoomSnapshot["players"] }) {
  const [selected, setSelected] = useState<number[]>([]);

  const toggle = (seat: number) => {
    setSelected((cur) => (cur.includes(seat) ? cur.filter((c) => c !== seat) : cur.length < 2 ? [...cur, seat] : cur));
  };

  const submit = () => {
    if (selected.length !== 2) return;
    socket.emit("night:troublemaker:swap", { seatA: selected[0], seatB: selected[1] });
  };

  return (
    <div className="panel">
      <h2>Troublemaker</h2>
      <p>Choose two other players to swap (you won't see the result):</p>
      <div className="choice-row">
        {others.map((p) => (
          <button
            key={p.socketId}
            className={selected.includes(p.seatIndex) ? "active" : ""}
            onClick={() => toggle(p.seatIndex)}
          >
            {p.name}
          </button>
        ))}
      </div>
      <button disabled={selected.length !== 2} onClick={submit}>
        Confirm Swap
      </button>
    </div>
  );
}
