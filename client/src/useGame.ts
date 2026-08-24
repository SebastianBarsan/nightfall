import { useEffect, useRef, useState } from "react";
import type { Role, RoomSnapshot } from "@nightfall/shared";
import { socket } from "./socket";

export interface SeerResult {
  roles: Role[];
  viewedPlayerSeat: number | null;
  viewedCenterIndices: number[] | null;
}

export interface GameUiState {
  connected: boolean;
  snapshot: RoomSnapshot | null;
  errorMessage: string | null;

  myRole: Role | null;
  fellowWolves: string[] | null;
  centerPromptIndices: number[] | null;
  centerResult: { centerIndex: number; role: Role } | null;
  seerPromptActive: boolean;
  seerResult: SeerResult | null;
  robberPromptActive: boolean;
  robberResult: { newRole: Role } | null;
  troublemakerPromptActive: boolean;
  troublemakerAcked: boolean;
  insomniacResult: { currentRole: Role } | null;
  coinSpawns: number;
  chatFlash: boolean;
}

const initialState: GameUiState = {
  connected: socket.connected,
  snapshot: null,
  errorMessage: null,
  myRole: null,
  fellowWolves: null,
  centerPromptIndices: null,
  centerResult: null,
  seerPromptActive: false,
  seerResult: null,
  robberPromptActive: false,
  robberResult: null,
  troublemakerPromptActive: false,
  troublemakerAcked: false,
  insomniacResult: null,
  coinSpawns: 0,
  chatFlash: false,
};

/** Central subscription hook: wires every socket.io event once and exposes UI-relevant state. */
export function useGame() {
  const [state, setState] = useState<GameUiState>(initialState);
  const prevPhase = useRef<string | null>(null);

  useEffect(() => {
    const onConnect = () => setState((s) => ({ ...s, connected: true }));
    const onDisconnect = () => setState((s) => ({ ...s, connected: false }));
    const onError = (p: { message: string }) => setState((s) => ({ ...s, errorMessage: p.message }));

    const onRoomState = (snapshot: RoomSnapshot) => {
      setState((s) => {
        const phaseChanged = prevPhase.current !== snapshot.phase;
        prevPhase.current = snapshot.phase;
        // Clear per-phase night/vote scratch state whenever the phase transitions.
        if (phaseChanged) {
          return {
            ...s,
            snapshot,
            fellowWolves: snapshot.phase === "NIGHT" ? s.fellowWolves : null,
            centerPromptIndices: null,
            centerResult: snapshot.phase === "NIGHT" ? s.centerResult : null,
            seerPromptActive: false,
            seerResult: snapshot.phase === "NIGHT" ? s.seerResult : null,
            robberPromptActive: false,
            robberResult: snapshot.phase === "NIGHT" ? s.robberResult : null,
            troublemakerPromptActive: false,
            troublemakerAcked: false,
            insomniacResult: snapshot.phase === "NIGHT" ? s.insomniacResult : null,
          };
        }
        return { ...s, snapshot };
      });
    };

    const onYourRole = (p: { role: Role }) =>
      setState((s) => ({
        ...s,
        myRole: p.role,
        fellowWolves: null,
        centerPromptIndices: null,
        centerResult: null,
        seerPromptActive: false,
        seerResult: null,
        robberPromptActive: false,
        robberResult: null,
        troublemakerPromptActive: false,
        troublemakerAcked: false,
        insomniacResult: null,
      }));

    const onCoinSpawn = () => setState((s) => ({ ...s, coinSpawns: s.coinSpawns + 1 }));
    const onWolfTeam = (p: { fellowWolfSocketIds: string[] }) =>
      setState((s) => ({ ...s, fellowWolves: p.fellowWolfSocketIds }));
    const onCenterPrompt = (p: { availableCenterIndices: number[] }) =>
      setState((s) => ({ ...s, centerPromptIndices: p.availableCenterIndices }));
    const onCenterResult = (p: { centerIndex: number; role: Role }) =>
      setState((s) => ({ ...s, centerResult: p, centerPromptIndices: null }));
    const onSeerPrompt = () => setState((s) => ({ ...s, seerPromptActive: true }));
    const onSeerResult = (p: SeerResult) => setState((s) => ({ ...s, seerResult: p, seerPromptActive: false }));
    const onRobberPrompt = () => setState((s) => ({ ...s, robberPromptActive: true }));
    const onRobberResult = (p: { newRole: Role }) =>
      setState((s) => ({ ...s, robberResult: p, robberPromptActive: false }));
    const onTroublemakerPrompt = () => setState((s) => ({ ...s, troublemakerPromptActive: true }));
    const onTroublemakerAck = () =>
      setState((s) => ({ ...s, troublemakerAcked: true, troublemakerPromptActive: false }));
    const onInsomniacResult = (p: { currentRole: Role }) => setState((s) => ({ ...s, insomniacResult: p }));

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("room:error", onError);
    socket.on("room:state", onRoomState);
    socket.on("night:yourRole", onYourRole);
    socket.on("coin:spawn", onCoinSpawn);
    socket.on("werewolf:teamReveal", onWolfTeam);
    socket.on("werewolf:centerPrompt", onCenterPrompt);
    socket.on("werewolf:centerResult", onCenterResult);
    socket.on("seer:prompt", onSeerPrompt);
    socket.on("seer:result", onSeerResult);
    socket.on("robber:prompt", onRobberPrompt);
    socket.on("robber:result", onRobberResult);
    socket.on("troublemaker:prompt", onTroublemakerPrompt);
    socket.on("troublemaker:ack", onTroublemakerAck);
    socket.on("insomniac:result", onInsomniacResult);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("room:error", onError);
      socket.off("room:state", onRoomState);
      socket.off("night:yourRole", onYourRole);
      socket.off("coin:spawn", onCoinSpawn);
      socket.off("werewolf:teamReveal", onWolfTeam);
      socket.off("werewolf:centerPrompt", onCenterPrompt);
      socket.off("werewolf:centerResult", onCenterResult);
      socket.off("seer:prompt", onSeerPrompt);
      socket.off("seer:result", onSeerResult);
      socket.off("robber:prompt", onRobberPrompt);
      socket.off("robber:result", onRobberResult);
      socket.off("troublemaker:prompt", onTroublemakerPrompt);
      socket.off("troublemaker:ack", onTroublemakerAck);
      socket.off("insomniac:result", onInsomniacResult);
    };
  }, []);

  const clearError = () => setState((s) => ({ ...s, errorMessage: null }));

  return { state, clearError };
}
