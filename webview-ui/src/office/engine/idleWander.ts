/** Manhattan (grid) distance between two tiles. */
export function manhattanDistance(aCol: number, aRow: number, bCol: number, bRow: number): number {
  return Math.abs(aCol - bCol) + Math.abs(aRow - bRow);
}

/**
 * The walkable tiles an idle agent may wander to, honoring "stay away from the
 * desk":
 *   - No seat  → any walkable tile (free wander; unchanged behavior).
 *   - Seat set → tiles at Manhattan distance ≥ minDistance from the seat.
 *   - If none are that far (cramped/blocked layout) → best-effort: the
 *     farthest walkable tile(s) from the seat, so the agent leaves the desk as
 *     much as the layout allows and never gets stuck.
 * Returns an empty array only when there are no walkable tiles at all.
 */
export function idleWanderCandidates(
  seat: { col: number; row: number } | null,
  walkableTiles: Array<{ col: number; row: number }>,
  minDistance: number,
): Array<{ col: number; row: number }> {
  if (!seat) return walkableTiles;
  if (walkableTiles.length === 0) return [];

  const farEnough = walkableTiles.filter(
    (t) => manhattanDistance(t.col, t.row, seat.col, seat.row) >= minDistance,
  );
  if (farEnough.length > 0) return farEnough;

  let maxDistance = -1;
  for (const t of walkableTiles) {
    const d = manhattanDistance(t.col, t.row, seat.col, seat.row);
    if (d > maxDistance) maxDistance = d;
  }
  return walkableTiles.filter(
    (t) => manhattanDistance(t.col, t.row, seat.col, seat.row) === maxDistance,
  );
}
