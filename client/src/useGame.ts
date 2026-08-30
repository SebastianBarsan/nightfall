import { useEffect, useRef, useState } from "react";
import type { AuthResult, LoginResult, PlayerStats, Role, RoomSnapshot } from "@nightfall/shared";
import { socket } from "./socket";

const TOKEN_KEY = "nightfall.authToken";

function readStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function storeToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // ignore — auth still works for this tab, just won't survive a reload
  }
}

function clearStoredToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore
  }
}

export interface SeerResult {
  roles: Role[];
  viewedPlayerSeat: number | null;
  viewedCenterIndices: number[] | null;
}

export interface AuthState {
  status: "loading" | "unauthenticated" | "authenticated";
  token: string | null;
  username: string | null;
  stats: PlayerStats | null;
}

export interface GameUiState {
  connected: boolean;
  snapshot: RoomSnapshot | null;
  errorMessage: string | null;
  auth: AuthState;

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
  insomniacPromptActive: boolean;
  insomniacResult: { currentRole: Role } | null;
  chatFlash: boolean;
}

const initialState: GameUiState = {
  connected: socket.connected,
  snapshot: null,
  errorMessage: null,
  auth: {
    status: readStoredToken() ? "loading" : "unauthenticated",
    token: readStoredToken(),
    username: null,
    stats: null,
  },
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
  insomniacPromptActive: false,
  insomniacResult: null,
  chatFlash: false,
};

/** Central subscription hook: wires every socket.io event once and exposes UI-relevant state. */
export function useGame() {
  const [state, setState] = useState<GameUiState>(initialState);
  const prevPhase = useRef<string | null>(null);
  const prevNightStepEndsAt = useRef<number | null>(null);

  useEffect(() => {
    const attemptResume = () => {
      const token = readStoredToken();
      if (!token) {
        setState((s) => ({ ...s, auth: { status: "unauthenticated", token: null, username: null, stats: null } }));
        return;
      }
      socket.emit("auth:resume", { token }, (res) => {
        if (res.ok) {
          setState((s) => ({ ...s, auth: { status: "authenticated", token: res.token, username: res.username, stats: res.stats } }));
        } else {
          clearStoredToken();
          setState((s) => ({ ...s, auth: { status: "unauthenticated", token: null, username: null, stats: null } }));
        }
      });
    };

    const onConnect = () => {
      setState((s) => ({ ...s, connected: true }));
      attemptResume();
    };
    const onDisconnect = () => setState((s) => ({ ...s, connected: false }));
    const onError = (p: { message: string }) => setState((s) => ({ ...s, errorMessage: p.message }));
    const onStatsUpdate = (p: { stats: PlayerStats }) =>
      setState((s) => ({ ...s, auth: { ...s.auth, stats: p.stats } }));

    attemptResume();

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
            insomniacPromptActive: false,
            insomniacResult: snapshot.phase === "NIGHT" ? s.insomniacResult : null,
          };
        }

        // Every server-side night step (acted on, timed out, or never had an actor) always
        // broadcasts a fresh nightStep.endsAt. Use that as the single source of truth for
        // "is this still my turn" so a tappable card's highlight can never outlive the turn it
        // belongs to, whether or not the player actually acted before time ran out.
        const nightStepChanged = prevNightStepEndsAt.current !== (snapshot.nightStep?.endsAt ?? null);
        prevNightStepEndsAt.current = snapshot.nightStep?.endsAt ?? null;
        if (nightStepChanged) {
          return {
            ...s,
            snapshot,
            centerPromptIndices: null,
            seerPromptActive: false,
            robberPromptActive: false,
            troublemakerPromptActive: false,
            insomniacPromptActive: false,
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
        insomniacPromptActive: false,
        insomniacResult: null,
      }));

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
    const onInsomniacPrompt = () => setState((s) => ({ ...s, insomniacPromptActive: true }));
    const onInsomniacResult = (p: { currentRole: Role }) =>
      setState((s) => ({ ...s, insomniacResult: p, insomniacPromptActive: false }));

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("room:error", onError);
    socket.on("stats:update", onStatsUpdate);
    socket.on("room:state", onRoomState);
    socket.on("night:yourRole", onYourRole);
    socket.on("werewolf:teamReveal", onWolfTeam);
    socket.on("werewolf:centerPrompt", onCenterPrompt);
    socket.on("werewolf:centerResult", onCenterResult);
    socket.on("seer:prompt", onSeerPrompt);
    socket.on("seer:result", onSeerResult);
    socket.on("robber:prompt", onRobberPrompt);
    socket.on("robber:result", onRobberResult);
    socket.on("troublemaker:prompt", onTroublemakerPrompt);
    socket.on("troublemaker:ack", onTroublemakerAck);
    socket.on("insomniac:prompt", onInsomniacPrompt);
    socket.on("insomniac:result", onInsomniacResult);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("room:error", onError);
      socket.off("stats:update", onStatsUpdate);
      socket.off("room:state", onRoomState);
      socket.off("night:yourRole", onYourRole);
      socket.off("werewolf:teamReveal", onWolfTeam);
      socket.off("werewolf:centerPrompt", onCenterPrompt);
      socket.off("werewolf:centerResult", onCenterResult);
      socket.off("seer:prompt", onSeerPrompt);
      socket.off("seer:result", onSeerResult);
      socket.off("robber:prompt", onRobberPrompt);
      socket.off("robber:result", onRobberResult);
      socket.off("troublemaker:prompt", onTroublemakerPrompt);
      socket.off("troublemaker:ack", onTroublemakerAck);
      socket.off("insomniac:prompt", onInsomniacPrompt);
      socket.off("insomniac:result", onInsomniacResult);
    };
  }, []);

  const clearError = () => setState((s) => ({ ...s, errorMessage: null }));

  const applyAuthOk = (res: { token: string; username: string; stats: PlayerStats }) => {
    storeToken(res.token);
    setState((s) => ({ ...s, auth: { status: "authenticated", token: res.token, username: res.username, stats: res.stats } }));
  };

  const login = (username: string, password: string): Promise<LoginResult> =>
    new Promise((resolve) => {
      socket.emit("auth:login", { username, password }, (res) => {
        if (res.ok) applyAuthOk(res);
        resolve(res);
      });
    });

  const register = (username: string, password: string): Promise<AuthResult> =>
    new Promise((resolve) => {
      socket.emit("auth:register", { username, password }, (res) => {
        if (res.ok) applyAuthOk(res);
        resolve(res);
      });
    });

  const logout = () => {
    const token = state.auth.token;
    if (token) socket.emit("auth:logout", { token });
    clearStoredToken();
    setState((s) => ({ ...s, auth: { status: "unauthenticated", token: null, username: null, stats: null } }));
  };

  return { state, clearError, login, register, logout };
}
