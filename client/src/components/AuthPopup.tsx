import { useState } from "react";
import { MIN_PASSWORD_LENGTH } from "@nightfall/shared";

type Stage = "enterPassword" | "confirmCreate" | "setNewPassword";

export function AuthPopup({
  username,
  login,
  register,
  onSuccess,
  onClose,
}: {
  username: string;
  login: (username: string, password: string) => Promise<{ ok: true } | { ok: false; error: "NOT_FOUND" | "WRONG_PASSWORD" | "SERVER_ERROR" | "RATE_LIMITED" }>;
  register: (username: string, password: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  onSuccess: () => void;
  onClose: () => void;
}) {
  const [stage, setStage] = useState<Stage>("enterPassword");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const tryLogin = async () => {
    setError(null);
    setBusy(true);
    const res = await login(username, password);
    setBusy(false);
    if (res.ok) {
      onSuccess();
    } else if (res.error === "NOT_FOUND") {
      setStage("confirmCreate");
    } else if (res.error === "SERVER_ERROR") {
      setError("Server error. Please try again.");
    } else if (res.error === "RATE_LIMITED") {
      setError("Too many attempts. Please wait a few minutes and try again.");
    } else {
      setError("Incorrect password.");
      setPassword("");
    }
  };

  const tryRegister = async () => {
    setError(null);
    setBusy(true);
    const res = await register(username, password);
    setBusy(false);
    if (res.ok) {
      onSuccess();
    } else {
      setError(res.error);
    }
  };

  return (
    <div className="auth-overlay" role="dialog" aria-modal="true">
      <div className="auth-modal panel">
        {stage === "enterPassword" ? (
          <>
            <h2>Welcome, {username}</h2>
            <label className="field">
              <span>Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && password && tryLogin()}
              />
            </label>
            {error ? <p className="error">{error}</p> : null}
            <div className="auth-actions">
              <button onClick={onClose} disabled={busy}>
                Cancel
              </button>
              <button onClick={tryLogin} disabled={busy || !password}>
                Continue
              </button>
            </div>
          </>
        ) : null}

        {stage === "confirmCreate" ? (
          <>
            <h2>No account named "{username}"</h2>
            <p>Would you like to create one?</p>
            <div className="auth-actions">
              <button onClick={onClose} disabled={busy}>
                Cancel
              </button>
              <button onClick={() => setStage("setNewPassword")} disabled={busy}>
                Create account
              </button>
            </div>
          </>
        ) : null}

        {stage === "setNewPassword" ? (
          <>
            <h2>Create account for {username}</h2>
            <label className="field">
              <span>New password</span>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
            </label>
            <label className="field">
              <span>Confirm password</span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && password === confirmPassword && password.length >= MIN_PASSWORD_LENGTH && tryRegister()}
              />
            </label>
            {password && confirmPassword && password !== confirmPassword ? <p className="error">Passwords don't match.</p> : null}
            {error ? <p className="error">{error}</p> : null}
            <div className="auth-actions">
              <button onClick={onClose} disabled={busy}>
                Cancel
              </button>
              <button
                onClick={tryRegister}
                disabled={busy || password.length < MIN_PASSWORD_LENGTH || password !== confirmPassword}
              >
                Create account
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
