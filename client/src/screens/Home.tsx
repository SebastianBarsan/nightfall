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
      <div className="home-scene">
        <div className="moon" />
        <div className="fog" />
        <div className="fireflies" aria-hidden="true">
          {Array.from({ length: 6 }, (_, i) => (
            <span key={i} className={`firefly firefly-${i}`} />
          ))}
        </div>

        <svg className="graveyard-svg" viewBox="0 0 400 100" preserveAspectRatio="none" aria-hidden="true">
          <path
            d="M40 92 L40 38 M40 55 L18 34 M40 48 L64 28 M40 40 L24 18 M40 40 L54 16"
            stroke="#1c1f38"
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
          />
          <path d="M106 92 L106 64 A10 10 0 0 1 126 64 L126 92 Z" fill="#232748" />
          <path d="M154 92 L154 58 A12 12 0 0 1 178 58 L178 92 Z" fill="#1c1f38" />
          <path d="M222 92 L222 67 A9 9 0 0 1 240 67 L240 92 Z" fill="#232748" />
          <path d="M296 92 L296 60 A11 11 0 0 1 318 60 L318 92 Z" fill="#1c1f38" />
          <path d="M350 92 L350 70 A8 8 0 0 1 366 70 L366 92 Z" fill="#232748" />
        </svg>

        <div className="home-content">
          <h1 className="home-title">Nightfall</h1>
          <p className="subtitle">A quiet game of hidden roles, played beneath a watchful moon.</p>

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
      </div>
    </div>
  );
}
