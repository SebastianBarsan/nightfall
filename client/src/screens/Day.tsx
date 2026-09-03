import { useState } from "react";
import type { RoomSnapshot } from "@nightfall/shared";
import { Countdown } from "../components/Countdown";
import { GameScene } from "../components/GameScene";
import { Table } from "../components/Table";
import { socket } from "../socket";

export function Day({ snapshot }: { snapshot: RoomSnapshot }) {
  const [text, setText] = useState("");

  const send = () => {
    if (!text.trim()) return;
    socket.emit("day:chat", { text });
    setText("");
  };

  return (
    <div className="screen day">
      <GameScene variant="day">
        <h1>Day</h1>
        {snapshot.dayEndsAt ? (
          <p className="hint">
            Discuss before voting begins: <Countdown endsAt={snapshot.dayEndsAt} />
          </p>
        ) : null}
      </GameScene>

      <Table players={snapshot.players} hostSocketId={snapshot.hostSocketId} mySocketId={socket.id ?? ""} />

      <div className="chat">
        <div className="chat-log">
          {snapshot.chat.length === 0 ? (
            <p className="chat-empty">No messages yet. Start the discussion.</p>
          ) : (
            snapshot.chat.map((m, i) => (
              <div key={i} className="chat-line">
                <strong>{m.name}:</strong> {m.text}
              </div>
            ))
          )}
        </div>
        <div className="chat-input">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Say something..."
            maxLength={300}
          />
          <button onClick={send}>Send</button>
        </div>
      </div>
    </div>
  );
}
