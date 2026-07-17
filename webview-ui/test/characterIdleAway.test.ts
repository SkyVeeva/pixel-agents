import assert from 'node:assert/strict';

import { test } from 'vitest';

import { IDLE_MIN_DISTANCE_FROM_SEAT_TILES } from '../src/constants.js';
import { createCharacter, updateCharacter } from '../src/office/engine/characters.js';
import { manhattanDistance } from '../src/office/engine/idleWander.js';
import type { Character, Seat, TileType as TileTypeVal } from '../src/office/types.js';
import { CharacterState, Direction, TileType } from '../src/office/types.js';

const COLS = 9;
const ROWS = 3;

/** All-FLOOR tile map. */
function openMap(): TileTypeVal[][] {
  const map: TileTypeVal[][] = [];
  for (let r = 0; r < ROWS; r++) {
    const row: TileTypeVal[] = [];
    for (let c = 0; c < COLS; c++) row.push(TileType.FLOOR_1 as TileTypeVal);
    map.push(row);
  }
  return map;
}

function allWalkable(): Array<{ col: number; row: number }> {
  const out: Array<{ col: number; row: number }> = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) out.push({ col: c, row: r });
  return out;
}

const SEAT: Seat = {
  uid: 'chair-1',
  seatCol: 0,
  seatRow: 1,
  facingDir: Direction.DOWN,
  assigned: true,
};

/** A character sitting at its seat, then forced into an idle, ready-to-wander state. */
function idleCharacterAtSeat(): Character {
  const ch = createCharacter(1, 0, SEAT.uid, SEAT);
  ch.state = CharacterState.IDLE;
  ch.isActive = false;
  ch.seatTimer = 0;
  ch.wanderTimer = 0; // expire immediately so the next update picks a target
  ch.path = [];
  ch.tileCol = SEAT.seatCol;
  ch.tileRow = SEAT.seatRow;
  return ch;
}

test('idle agent walks to a tile at least IDLE_MIN_DISTANCE_FROM_SEAT_TILES from its seat', () => {
  const map = openMap();
  const walkable = allWalkable();
  const seats = new Map<string, Seat>([[SEAT.uid, SEAT]]);
  const blocked = new Set<string>();

  // Loop to defeat the random target pick — EVERY run must respect the rule.
  for (let i = 0; i < 30; i++) {
    const ch = idleCharacterAtSeat();
    updateCharacter(ch, 0.1, walkable, seats, map, blocked);
    assert.equal(ch.state, CharacterState.WALK, 'idle agent should start walking');
    const dest = ch.path[ch.path.length - 1];
    assert.ok(dest, 'a path was chosen');
    const dist = manhattanDistance(dest.col, dest.row, SEAT.seatCol, SEAT.seatRow);
    assert.ok(
      dist >= IDLE_MIN_DISTANCE_FROM_SEAT_TILES,
      `destination (${dest.col},${dest.row}) is only ${dist} from seat`,
    );
  }
});

test('idle agent never targets its own seat', () => {
  const map = openMap();
  const walkable = allWalkable();
  const seats = new Map<string, Seat>([[SEAT.uid, SEAT]]);
  const blocked = new Set<string>();

  for (let i = 0; i < 30; i++) {
    const ch = idleCharacterAtSeat();
    updateCharacter(ch, 0.1, walkable, seats, map, blocked);
    const dest = ch.path[ch.path.length - 1];
    if (dest) {
      assert.ok(
        !(dest.col === SEAT.seatCol && dest.row === SEAT.seatRow),
        'idle agent must not walk back to its seat',
      );
    }
  }
});

test('becoming active again sends the agent back to its seat', () => {
  const map = openMap();
  const walkable = allWalkable();
  const seats = new Map<string, Seat>([[SEAT.uid, SEAT]]);
  const blocked = new Set<string>();

  const ch = idleCharacterAtSeat();
  ch.tileCol = 5; // idling away from the desk
  ch.tileRow = 1;
  ch.isActive = true;

  updateCharacter(ch, 0.1, walkable, seats, map, blocked);
  assert.equal(ch.state, CharacterState.WALK, 'active agent walks back');
  const dest = ch.path[ch.path.length - 1];
  assert.deepEqual(dest, { col: SEAT.seatCol, row: SEAT.seatRow });
});
