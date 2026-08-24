import { useState } from "react";
import { socket } from "../socket";

export function Home() {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const create = () => {
    setError(null);
    setBusy(true);
    socket.emit("room:create", { name }, (res) => {
      setBusy(false);
      if (!res.ok) setError(res.error);
    });
  };

  const join = () => {
    setError(null);
    setBusy(true);
    socket.emit("room:join", { code: code.trim().toUpperCase(), name }, (res) => {
      setBusy(false);
      if (!res.ok) setError(res.error);
    });
  };

  return (
    <div className="screen home">
      <h1>🌙 Nightfall</h1>
      <p className="subtitle">A social deduction game of hidden roles and shifting cards.</p>

      <label className="field">
        <span>Your name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={20} placeholder="Enter your name" />
      </label>

      <div className="home-actions">
        <button disabled={busy || !name.trim()} onClick={create}>
          Create Room
        </button>

        <div className="join-row">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="ROOM-CODE"
            maxLength={9}
          />
          <button disabled={busy || !name.trim() || !code.trim()} onClick={join}>
            Join Room
          </button>
        </div>
      </div>

      {error ? <p className="error">{error}</p> : null}
    </div>
  );
}
