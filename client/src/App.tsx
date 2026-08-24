import { GamePhase } from "@nightfall/shared";
import "./App.css";
import { Home } from "./screens/Home";
import { Lobby } from "./screens/Lobby";
import { Night } from "./screens/Night";
import { Day } from "./screens/Day";
import { Voting } from "./screens/Voting";
import { Reveal } from "./screens/Reveal";
import { useGame } from "./useGame";

export default function App() {
  const { state, clearError } = useGame();

  return (
    <div className="app">
      {!state.connected ? <div className="connection-banner">Connecting to server...</div> : null}
      {state.errorMessage ? (
        <div className="error-toast" onClick={clearError}>
          {state.errorMessage} (click to dismiss)
        </div>
      ) : null}

      {renderScreen()}
    </div>
  );

  function renderScreen() {
    const snapshot = state.snapshot;
    if (!snapshot) return <Home />;

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
