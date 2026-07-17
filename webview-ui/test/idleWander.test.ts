import assert from 'node:assert/strict';

import { test } from 'vitest';

import { idleWanderCandidates, manhattanDistance } from '../src/office/engine/idleWander.js';

const tiles = (...pairs: Array<[number, number]>) => pairs.map(([col, row]) => ({ col, row }));

test('manhattanDistance sums absolute deltas', () => {
  assert.equal(manhattanDistance(0, 0, 3, 0), 3);
  assert.equal(manhattanDistance(2, 5, 0, 0), 7);
});

test('no seat → any walkable tile is a candidate', () => {
  const all = tiles([0, 0], [1, 0], [2, 0]);
  assert.deepEqual(idleWanderCandidates(null, all, 3), all);
});

test('with a seat → only tiles at least minDistance away', () => {
  const all = tiles([0, 0], [1, 0], [2, 0], [3, 0], [4, 0]);
  const result = idleWanderCandidates({ col: 0, row: 0 }, all, 3);
  assert.deepEqual(result, tiles([3, 0], [4, 0]));
});

test('best-effort: when nothing is far enough, return the farthest tile(s)', () => {
  const all = tiles([0, 0], [1, 0], [2, 0]); // max distance from seat is 2
  const result = idleWanderCandidates({ col: 0, row: 0 }, all, 3);
  assert.deepEqual(result, tiles([2, 0]));
});

test('empty walkable tiles → empty candidates', () => {
  assert.deepEqual(idleWanderCandidates({ col: 0, row: 0 }, [], 3), []);
});
