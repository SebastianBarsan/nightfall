import { useState } from "react";
import { GamePhase } from "@nightfall/shared";
import "./App.css";
import { StatsPanel } from "./components/StatsPanel";
import { Home } from "./screens/Home";
import { Lobby } from "./screens/Lobby";
import { Night } from "./screens/Night";
import { Day } from "./screens/Day";
import { Voting } from "./screens/Voting";
import { Reveal } from "./screens/Reveal";
import { useGame } from "./useGame";

const STATS_VISIBLE_KEY = "nightfall.statsPanelVisible";

function readStatsVisible(): boolean {
  try {
    return localStorage.getItem(STATS_VISIBLE_KEY) !== "false";
  } catch {
    return true;
  }
}

export default function App() {
  const { state, clearError, login, register, logout } = useGame();
  const [statsVisible, setStatsVisible] = useState(readStatsVisible);

  const setStatsVisibility = (visible: boolean) => {
    setStatsVisible(visible);
    try {
      localStorage.setItem(STATS_VISIBLE_KEY, String(visible));
    } catch {
      // ignore — the toggle still works for this tab, just won't be remembered
    }
  };

  return (
    <div className="app">
      {!state.connected ? <div className="connection-banner">Connecting to server...</div> : null}
      {state.errorMessage ? (
        <div className="error-toast" onClick={clearError}>
          {state.errorMessage} (click to dismiss)
        </div>
      ) : null}

      {state.auth.stats && state.auth.username ? (
        statsVisible ? (
          <StatsPanel
            stats={state.auth.stats}
            username={state.auth.username}
            onLogout={logout}
            onHide={() => setStatsVisibility(false)}
          />
        ) : (
          <button className="stats-panel-reopen" onClick={() => setStatsVisibility(true)}>
            Stats
          </button>
        )
      ) : null}

      {renderScreen()}
    </div>
  );

  function renderScreen() {
    const snapshot = state.snapshot;
    if (!snapshot) return <Home auth={state.auth} login={login} register={register} />;

    switch (snapshot.phase) {
      case GamePhase.LOBBY:
        return <Lobby snapshot={snapshot} />;
      case GamePhase.NIGHT:
        return <Night snapshot={snapshot} ui={state} />;
      case GamePhase.DAY:
        return <Day snapshot={snapshot} />;
      case GamePhase.VOTING:
      case GamePhase.HUNTER_RESOLUTION:
        return <Voting snapshot={snapshot} />;
      case GamePhase.REVEAL:
        return <Reveal snapshot={snapshot} />;
      default:
        return null;
    }
  }
}
