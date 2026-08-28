import {
  MANDATORY_SINGLE_ROLES,
  MAX_PLAYERS,
  maxWerewolfCount,
  MIN_PLAYERS,
  minWerewolfCount,
  Role,
  roleCountsTotal,
  roleDisplayName,
  totalCardSlots,
  validateRoleCounts,
  type RoleCounts,
  type RoomSnapshot,
} from "@nightfall/shared";
import { Table } from "../components/Table";
import { socket } from "../socket";

export function Lobby({ snapshot }: { snapshot: RoomSnapshot }) {
  const isHost = snapshot.hostSocketId === socket.id;
  const count = snapshot.players.length;
  const roleError = validateRoleCounts(count, snapshot.roleCounts);
  const canStart = count >= MIN_PLAYERS && count <= MAX_PLAYERS && !roleError;

  return (
    <div className="screen lobby">
      <h1>Lobby</h1>
      <div className="room-code">
        Room code: <span>{snapshot.code}</span>
      </div>
      <p className="hint">Share this code with the other players.</p>

      <Table players={snapshot.players} hostSocketId={snapshot.hostSocketId} mySocketId={socket.id ?? ""} />

      <p className="hint">
        {count} / {MAX_PLAYERS} players ({MIN_PLAYERS}-{MAX_PLAYERS} required)
      </p>

      {isHost ? (
        <RoleEditor playerCount={count} roleCounts={snapshot.roleCounts} />
      ) : (
        <RoleSummary playerCount={count} roleCounts={snapshot.roleCounts} />
      )}

      {roleError ? <p className="error">{roleError}</p> : null}

      {isHost ? (
        <button disabled={!canStart} onClick={() => socket.emit("room:start")}>
          Start Game
        </button>
      ) : (
        <p className="hint">Waiting for the host to start the game...</p>
      )}
    </div>
  );
}

function RoleSummary({ playerCount, roleCounts }: { playerCount: number; roleCounts: RoleCounts }) {
  const total = roleCountsTotal(roleCounts);
  const expected = totalCardSlots(playerCount);
  return (
    <div className="panel roles-panel">
      <h2>Roles in play</h2>
      <ul className="roles-list">
        <li>{roleDisplayName(Role.WEREWOLF)} x{roleCounts.werewolf}</li>
        {MANDATORY_SINGLE_ROLES.map((r) => (
          <li key={r}>{roleDisplayName(r)} x1</li>
        ))}
        {roleCounts.insomniac ? <li>{roleDisplayName(Role.INSOMNIAC)} x1</li> : null}
        {roleCounts.hunter ? <li>{roleDisplayName(Role.HUNTER)} x1</li> : null}
        <li>{roleDisplayName(Role.VILLAGER)} x{roleCounts.villager}</li>
      </ul>
      <p className="hint">
        {total} / {expected} cards
      </p>
    </div>
  );
}

function RoleEditor({ playerCount, roleCounts }: { playerCount: number; roleCounts: RoleCounts }) {
  const min = minWerewolfCount(playerCount);
  const max = maxWerewolfCount(playerCount);
  const total = roleCountsTotal(roleCounts);
  const expected = totalCardSlots(playerCount);

  const push = (next: RoleCounts) => socket.emit("room:configureRoles", { roleCounts: next });

  return (
    <div className="panel roles-panel">
      <h2>Roles in play</h2>

      <div className="role-row">
        <span className="role-name">{roleDisplayName(Role.WEREWOLF)}</span>
        <div className="stepper">
          <button disabled={roleCounts.werewolf <= min} onClick={() => push({ ...roleCounts, werewolf: roleCounts.werewolf - 1 })}>
            −
          </button>
          <span>{roleCounts.werewolf}</span>
          <button disabled={roleCounts.werewolf >= max} onClick={() => push({ ...roleCounts, werewolf: roleCounts.werewolf + 1 })}>
            +
          </button>
        </div>
        <span className="hint">
          ({min}-{max})
        </span>
      </div>

      {MANDATORY_SINGLE_ROLES.map((r) => (
        <div className="role-row" key={r}>
          <span className="role-name">{roleDisplayName(r)}</span>
          <span className="hint">always 1</span>
        </div>
      ))}

      <div className="role-row">
        <span className="role-name">{roleDisplayName(Role.INSOMNIAC)}</span>
        <label className="role-toggle">
          <input
            type="checkbox"
            checked={roleCounts.insomniac === 1}
            onChange={(e) => push({ ...roleCounts, insomniac: e.target.checked ? 1 : 0 })}
          />
          Include
        </label>
      </div>

      <div className="role-row">
        <span className="role-name">{roleDisplayName(Role.HUNTER)}</span>
        <label className="role-toggle">
          <input
            type="checkbox"
            checked={roleCounts.hunter === 1}
            onChange={(e) => push({ ...roleCounts, hunter: e.target.checked ? 1 : 0 })}
          />
          Include
        </label>
      </div>

      <div className="role-row">
        <span className="role-name">{roleDisplayName(Role.VILLAGER)}</span>
        <div className="stepper">
          <button disabled={roleCounts.villager <= 0} onClick={() => push({ ...roleCounts, villager: roleCounts.villager - 1 })}>
            −
          </button>
          <span>{roleCounts.villager}</span>
          <button onClick={() => push({ ...roleCounts, villager: roleCounts.villager + 1 })}>+</button>
        </div>
      </div>

      <p className={`hint role-total${total === expected ? " ok" : " mismatch"}`}>
        {total} / {expected} cards
      </p>
    </div>
  );
}
