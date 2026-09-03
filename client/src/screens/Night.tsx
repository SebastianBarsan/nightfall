import { useEffect, useState } from "react";
import { Role, type PublicPlayer, type RoomSnapshot } from "@nightfall/shared";
import { Countdown } from "../components/Countdown";
import { GameScene } from "../components/GameScene";
import { RoleReveal } from "../components/RoleReveal";
import { Table } from "../components/Table";
import { socket } from "../socket";
import type { GameUiState } from "../useGame";
import { roleColor, roleDisplayName } from "../roleTheme";

export function Night({ snapshot, ui }: { snapshot: RoomSnapshot; ui: GameUiState }) {
  const n = snapshot.players.length;

  // Belt-and-suspenders: even if a stale prompt flag slipped through, tie every tap-target
  // highlight to the server's public "whose turn is it" field so it can never show outside the
  // exact step it belongs to — not a moment before it starts, not a moment after it ends.
  const currentStepRole = snapshot.nightStep?.role ?? null;
  const wolfCenterMode = !!ui.centerPromptIndices && !ui.centerResult && currentStepRole === Role.WEREWOLF;
  const seerMode = ui.seerPromptActive && currentStepRole === Role.SEER;
  const robberMode = ui.robberPromptActive && currentStepRole === Role.ROBBER;
  const troublemakerMode = ui.troublemakerPromptActive && currentStepRole === Role.TROUBLEMAKER;
  const insomniacMode = ui.insomniacPromptActive && currentStepRole === Role.INSOMNIAC;

  const [selectedCenters, setSelectedCenters] = useState<number[]>([]);
  const [selectedSeats, setSelectedSeats] = useState<number[]>([]);
  const [revealDismissed, setRevealDismissed] = useState(false);

  // Local tap selections only make sense for the prompt they were made under.
  useEffect(() => {
    setSelectedCenters([]);
    setSelectedSeats([]);
  }, [wolfCenterMode, seerMode, robberMode, troublemakerMode]);

  const selectableSeatIds = new Set<string>();
  if (seerMode || robberMode || troublemakerMode) {
    snapshot.players.forEach((p) => {
      if (p.socketId !== socket.id) selectableSeatIds.add(p.socketId);
    });
  }
  if (insomniacMode && socket.id) selectableSeatIds.add(socket.id);
  const selectedSeatIds = new Set(
    selectedSeats.map((seat) => snapshot.players[seat]?.socketId).filter((id): id is string => Boolean(id)),
  );

  const selectableCenters = new Set<number>();
  if (seerMode) [n, n + 1, n + 2].forEach((c) => selectableCenters.add(c));
  if (wolfCenterMode) ui.centerPromptIndices!.forEach((c) => selectableCenters.add(c));
  const selectedCentersSet = new Set(selectedCenters);

  const handleSeatClick = (p: PublicPlayer) => {
    if (insomniacMode && p.socketId === socket.id) {
      socket.emit("night:insomniac:reveal");
      return;
    }
    if (seerMode) {
      socket.emit("night:seer:target", { playerSeat: p.seatIndex, centerIndices: null });
      return;
    }
    if (robberMode) {
      socket.emit("night:robber:target", { playerSeat: p.seatIndex });
      return;
    }
    if (troublemakerMode) {
      setSelectedSeats((cur) => {
        if (cur.includes(p.seatIndex)) return cur.filter((s) => s !== p.seatIndex);
        if (cur.length >= 2) return cur;
        return [...cur, p.seatIndex];
      });
    }
  };

  const handleCenterClick = (globalIndex: number) => {
    if (wolfCenterMode) {
      socket.emit("night:werewolf:viewCenter", { centerIndex: globalIndex });
      return;
    }
    if (seerMode) {
      setSelectedCenters((cur) => {
        if (cur.includes(globalIndex)) return cur.filter((c) => c !== globalIndex);
        if (cur.length >= 2) return cur;
        return [...cur, globalIndex];
      });
    }
  };

  const confirmSeerCenters = () => {
    if (selectedCenters.length !== 2) return;
    socket.emit("night:seer:target", { playerSeat: null, centerIndices: selectedCenters });
  };

  const confirmTroublemakerSwap = () => {
    if (selectedSeats.length !== 2) return;
    socket.emit("night:troublemaker:swap", { seatA: selectedSeats[0], seatB: selectedSeats[1] });
  };

  return (
    <div className="screen night">
      {ui.myRole && !revealDismissed ? (
        <RoleReveal role={ui.myRole} onDone={() => setRevealDismissed(true)} />
      ) : null}
      <GameScene variant="night">
        <h1>Night</h1>
        {ui.myRole ? (
          <p className="role-badge" style={{ borderColor: roleColor(ui.myRole), color: roleColor(ui.myRole) }}>
            Your role: <strong>{roleDisplayName(ui.myRole)}</strong>
          </p>
        ) : null}

        {snapshot.nightStep ? (
          <div className="turn-banner">
            {roleDisplayName(snapshot.nightStep.role)} phase — <Countdown endsAt={snapshot.nightStep.endsAt} />
          </div>
        ) : null}
      </GameScene>

      <Table
        players={snapshot.players}
        hostSocketId={snapshot.hostSocketId}
        mySocketId={socket.id ?? ""}
        seatBadge={(p) => (ui.fellowWolves?.includes(p.socketId) ? <span className="fellow-mark" title="Fellow Vampire" /> : null)}
        onSeatClick={handleSeatClick}
        selectableSeatIds={selectableSeatIds}
        selectedSeatIds={selectedSeatIds}
        onCenterClick={handleCenterClick}
        selectableCenterIndices={selectableCenters}
        selectedCenterIndices={selectedCentersSet}
      />

      {ui.fellowWolves ? (
        <div className="panel">
          <h2>Fellow Vampires</h2>
          {ui.fellowWolves.length === 0 ? (
            <p>You are the only Vampire among the players.</p>
          ) : (
            <ul>
              {ui.fellowWolves.map((id) => (
                <li key={id}>{snapshot.players.find((p) => p.socketId === id)?.name ?? "?"}</li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {wolfCenterMode ? <p className="hint">No other player is a Vampire. Tap a center card to peek at it.</p> : null}
      {ui.centerResult ? (
        <div className="panel">
          <h2>Center Card Revealed</h2>
          <p>
            Center card {ui.centerResult.centerIndex - n + 1}: <strong>{roleDisplayName(ui.centerResult.role)}</strong>
          </p>
        </div>
      ) : null}

      {seerMode ? (
        <>
          <p className="hint">Tap a player's card to view it, or tap two center cards then confirm.</p>
          {selectedCenters.length === 2 ? (
            <div className="choice-row">
              <button onClick={confirmSeerCenters}>Confirm</button>
            </div>
          ) : null}
        </>
      ) : null}
      {ui.seerResult ? (
        <div className="panel">
          <h2>Vision</h2>
          {ui.seerResult.viewedPlayerSeat !== null ? (
            <p>
              {snapshot.players[ui.seerResult.viewedPlayerSeat]?.name}'s card: <strong>{roleDisplayName(ui.seerResult.roles[0])}</strong>
            </p>
          ) : (
            <p>
              Center cards: <strong>{ui.seerResult.roles.map(roleDisplayName).join(", ")}</strong>
            </p>
          )}
        </div>
      ) : null}

      {robberMode ? <p className="hint">Tap another player's card to swap it with yours.</p> : null}
      {ui.robberResult ? (
        <div className="panel">
          <h2>You Stole a Card</h2>
          <p>
            Your new role: <strong>{roleDisplayName(ui.robberResult.newRole)}</strong>
          </p>
        </div>
      ) : null}

      {troublemakerMode ? (
        <>
          <p className="hint">Tap two other players' cards to swap them.</p>
          {selectedSeats.length === 2 ? (
            <div className="choice-row">
              <button onClick={confirmTroublemakerSwap}>Confirm Swap</button>
            </div>
          ) : null}
        </>
      ) : null}
      {ui.troublemakerAcked ? (
        <div className="panel">
          <h2>Cards Swapped</h2>
          <p>You swapped two players' cards. You don't know what they became.</p>
        </div>
      ) : null}

      {insomniacMode ? <p className="hint">Tap your own card to check it.</p> : null}
      {ui.insomniacResult ? (
        <div className="panel">
          <h2>Sentry Check</h2>
          <p>
            Your current card is now: <strong>{roleDisplayName(ui.insomniacResult.currentRole)}</strong>
          </p>
        </div>
      ) : null}
    </div>
  );
}
