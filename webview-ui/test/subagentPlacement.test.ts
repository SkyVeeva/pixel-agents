import assert from 'node:assert/strict';

import { test } from 'vitest';

import { closestFreeSeat, subagentFallbackTile } from '../src/office/engine/subagentPlacement.js';
import type { Seat } from '../src/office/types.js';
import { Direction } from '../src/office/types.js';

function seat(uid: string, col: number, row: number, assigned = false): Seat {
  return { uid, seatCol: col, seatRow: row, facingDir: Direction.DOWN, assigned };
}

/** All-walkable grid of the given size, as the {col,row} list the FSM uses. */
function openGrid(cols: number, rows: number): Array<{ col: number; row: number }> {
  const out: Array<{ col: number; row: number }> = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out.push({ col: c, row: r });
  return out;
}

test('closestFreeSeat returns the nearest unassigned seat to the parent', () => {
  const seats = new Map<string, Seat>([
    ['a', seat('a', 10, 10)],
    ['b', seat('b', 2, 2)],
    ['c', seat('c', 5, 5)],
  ]);
  assert.equal(closestFreeSeat(1, 1, seats), 'b');
});

test('closestFreeSeat skips assigned (occupied) seats', () => {
  const seats = new Map<string, Seat>([
    ['a', seat('a', 2, 2, true)], // closest, but taken
    ['b', seat('b', 5, 5)],
  ]);
  assert.equal(closestFreeSeat(1, 1, seats), 'b');
});

test('closestFreeSeat returns null when every seat is assigned', () => {
  const seats = new Map<string, Seat>([['a', seat('a', 2, 2, true)]]);
  assert.equal(closestFreeSeat(1, 1, seats), null);
});

test('subagentFallbackTile prefers the tile behind the parent', () => {
  // Parent at (5,5) facing DOWN → behind is (5,4).
  const t = subagentFallbackTile(5, 5, Direction.DOWN, openGrid(10, 10), new Set());
  assert.deepEqual(t, { col: 5, row: 4 });
});

test('subagentFallbackTile uses an adjacent tile when behind is occupied', () => {
  const occupied = new Set(['5,4']); // behind (up) taken
  const t = subagentFallbackTile(5, 5, Direction.DOWN, openGrid(10, 10), occupied);
  assert.deepEqual(t, { col: 5, row: 6 }); // next candidate: down
});

test('subagentFallbackTile falls back to the nearest free walkable tile', () => {
  // Only (0,0) [parent, occupied] and (3,0) are walkable; no free neighbour.
  const walk = [
    { col: 0, row: 0 },
    { col: 3, row: 0 },
  ];
  const t = subagentFallbackTile(0, 0, Direction.DOWN, walk, new Set(['0,0']));
  assert.deepEqual(t, { col: 3, row: 0 });
});
