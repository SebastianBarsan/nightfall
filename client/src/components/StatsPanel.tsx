import { Role, roleDisplayName, type PlayerStats } from "@nightfall/shared";

const ALL_ROLES = Object.values(Role);

function RoleCountList({ counts }: { counts: Record<Role, number> }) {
  return (
    <ul className="stats-role-list">
      {ALL_ROLES.map((role) => (
        <li key={role}>
          <span className="role-badge">{roleDisplayName(role)}</span> {counts[role]}
        </li>
      ))}
    </ul>
  );
}

export function StatsPanel({
  stats,
  username,
  onLogout,
  onHide,
}: {
  stats: PlayerStats;
  username: string;
  onLogout: () => void;
  onHide: () => void;
}) {
  return (
    <div className="stats-panel panel">
      <div className="stats-panel-header">
        <span className="stats-panel-title">{username}'s stats</span>
        <div className="stats-panel-header-actions">
          <button className="link-button" onClick={onHide}>
            Hide
          </button>
          <button className="link-button" onClick={onLogout}>
            Log out
          </button>
        </div>
      </div>

      <div className="stats-panel-body">
        <p>
          Games played: <strong>{stats.gamesPlayed}</strong>
        </p>
        <p>
          Wins: <strong>{stats.wins}</strong> &middot; Losses: <strong>{stats.losses}</strong>
        </p>
        <p>
          Wins as Mortal: <strong>{stats.winsGood}</strong> &middot; Wins as Vampire: <strong>{stats.winsEvil}</strong> &middot; Wins as
          Jester: <strong>{stats.winsJester}</strong>
        </p>
        <p>
          Vampires eliminated as Hunter: <strong>{stats.hunterShotsHit}</strong>
          {stats.hunterShotAccuracy !== null ? ` (${Math.round(stats.hunterShotAccuracy * 100)}% accuracy)` : " (no shots taken yet)"}
        </p>
        <p>
          MVP awards: <strong>{stats.mvpCount}</strong>
        </p>
        <p>
          Current win streak: <strong>{stats.currentWinStreak}</strong> &middot; Longest: <strong>{stats.longestWinStreak}</strong>
        </p>
        <p>
          Most common starting role:{" "}
          <strong>{stats.mostCommonStartingRole ? roleDisplayName(stats.mostCommonStartingRole) : "—"}</strong>
        </p>
        <p>
          Most common ending role: <strong>{stats.mostCommonEndingRole ? roleDisplayName(stats.mostCommonEndingRole) : "—"}</strong>
        </p>

        <details>
          <summary>Full role breakdown</summary>
          <div className="stats-role-breakdown">
            <div>
              <h4>Starting roles</h4>
              <RoleCountList counts={stats.startingRoleCounts} />
            </div>
            <div>
              <h4>Ending roles</h4>
              <RoleCountList counts={stats.endingRoleCounts} />
            </div>
          </div>
        </details>
      </div>
    </div>
  );
}
