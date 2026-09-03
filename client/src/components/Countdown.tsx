import { useEffect, useState } from "react";

export function Countdown({ endsAt }: { endsAt: number }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  const remainingMs = Math.max(0, endsAt - now);
  const seconds = Math.ceil(remainingMs / 1000);
  const mm = Math.floor(seconds / 60);
  const ss = seconds % 60;
  const urgent = seconds > 0 && seconds <= 5;

  return (
    <span className={`countdown${urgent ? " countdown--urgent" : ""}`}>
      {mm}:{ss.toString().padStart(2, "0")}
    </span>
  );
}
