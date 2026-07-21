import type { Seat } from '../types.js';
import { Direction } from '../types.js';

function manhattan(aCol: number, aRow: number, bCol: number, bRow: number): number {
  return Math.abs(aCol - bCol) + Math.abs(aRow - bRow);
}

/**
 * The unassigned seat closest (Manhattan) to the parent, or null when every
 * seat is taken. A working sub-agent belongs at a free computer; this chooses
 * the nearest one to its parent. Ties resolve to the first such seat in
 * iteration (insertion) order.
 */
export function closestFreeSeat(
  parentCol: number,
  parentRow: number,
  seats: Map<string, Seat>,
): string | null {
  let best: string | null = null;
  let bestDist = Infinity;
  for (const [uid, seat] of seats) {
    if (seat.assigned) continue;
    const d = manhattan(seat.seatCol, seat.seatRow, parentCol, parentRow);
    if (d < bestDist) {
      bestDist = d;
      best = uid;
    }
  }
  return best;
}

/** The tile directly behind the parent (opposite the way it faces). */
function behindTile(
  parentCol: number,
  parentRow: number,
  dir: Direction,
): { col: number; row: number } {
  switch (dir) {
    case Direction.DOWN:
      return { col: parentCol, row: parentRow - 1 }; // faces down → behind is up
    case Direction.UP:
      return { col: parentCol, row: parentRow + 1 };
    case Direction.LEFT:
      return { col: parentCol + 1, row: parentRow };
    case Direction.RIGHT:
      return { col: parentCol - 1, row: parentRow };
    default:
      return { col: parentCol, row: parentRow - 1 };
  }
}

/**
 * Where an unseated sub-agent stands when the office is full: directly behind
 * the parent if that tile is free, else an adjacent free tile, else the nearest
 * free walkable tile, else the parent's own tile (last resort). A tile is
 * eligible only if it is walkable and not already occupied by another character.
 */
export function subagentFallbackTile(
  parentCol: number,
  parentRow: number,
  parentDir: Direction,
  walkableTiles: Array<{ col: number; row: number }>,
  occupiedTiles: Set<string>,
): { col: number; row: number } {
  const walkable = new Set(walkableTiles.map((t) => `${t.col},${t.row}`));
  const free = (col: number, row: number) =>
    walkable.has(`${col},${row}`) && !occupiedTiles.has(`${col},${row}`);

  // Behind the parent first, then the other orthogonal neighbours.
  const behind = behindTile(parentCol, parentRow, parentDir);
  const candidates = [
    behind,
    { col: parentCol, row: parentRow - 1 },
    { col: parentCol, row: parentRow + 1 },
    { col: parentCol - 1, row: parentRow },
    { col: parentCol + 1, row: parentRow },
  ];
  for (const t of candidates) {
    if (free(t.col, t.row)) return t;
  }

  // Nearest free walkable tile anywhere.
  let best: { col: number; row: number } | null = null;
  let bestDist = Infinity;
  for (const t of walkableTiles) {
    if (occupiedTiles.has(`${t.col},${t.row}`)) continue;
    const d = manhattan(t.col, t.row, parentCol, parentRow);
    if (d < bestDist) {
      bestDist = d;
      best = t;
    }
  }
  return best ?? { col: parentCol, row: parentRow };
}
