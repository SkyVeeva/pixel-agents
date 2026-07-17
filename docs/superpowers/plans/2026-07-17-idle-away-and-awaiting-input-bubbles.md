# Idle-away movement + persistent awaiting-input bubble — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a persistent speech bubble above any agent awaiting the user's input, and make idle agents step away from their desk (≥3 tiles) and mill there instead of sitting back down.

**Architecture:** Two isolated changes in the webview game layer (`webview-ui/src/office/engine/`). Each introduces one small pure helper (unit-tested in the existing Vitest node suite), then wires it into the existing render/FSM code. No server, protocol, persistence, or asset changes.

**Tech Stack:** TypeScript, React 19 canvas renderer, Vitest (node environment). Tests live in `webview-ui/test/*.test.ts` and use `node:assert/strict` + `vitest` (mirror `webview-ui/test/petEntity.test.ts`).

## Global Constraints

- No `enum` — use existing `as const` objects (`CharacterState`, `Direction`, `TileType`). (webview `erasableSyntaxOnly`)
- `import type` for type-only imports; `.js` extension on every relative import. (webview `verbatimModuleSyntax`)
- No inline color/number literals that belong in `constants.ts` — the one new tunable (`IDLE_MIN_DISTANCE_FROM_SEAT_TILES`) goes in `webview-ui/src/constants.ts`.
- The husky pre-commit hook runs `eslint --fix` + `prettier` on staged files, so it may re-sort imports / reformat on commit — expected; re-`git add` is handled by lint-staged automatically.
- Run webview tests from the `webview-ui/` directory: `npx vitest run test/<file>.test.ts`.

---

### Task 1: Persistent "awaiting input" bubble

**Files:**

- Create: `webview-ui/src/office/engine/bubbleBehavior.ts`
- Create: `webview-ui/test/bubbleBehavior.test.ts`
- Modify: `webview-ui/src/office/engine/officeState.ts` (bubble countdown, ~lines 1023-1030; import)
- Modify: `webview-ui/src/office/engine/renderer.ts` (bubble skip + alpha, ~lines 740-753; import)

**Interfaces:**

- Produces: `isPersistentWaitingBubble(bubbleType: 'permission' | 'waiting' | null, waitingAwaitingInput: boolean | undefined): boolean` — the single rule shared by the renderer and the update loop.

- [ ] **Step 1: Write the failing test**

Create `webview-ui/test/bubbleBehavior.test.ts`:

```ts
import assert from 'node:assert/strict';

import { test } from 'vitest';

import { isPersistentWaitingBubble } from '../src/office/engine/bubbleBehavior.js';

test('awaiting-input waiting bubble is persistent', () => {
  assert.equal(isPersistentWaitingBubble('waiting', true), true);
});

test('turn-finished ("Done") waiting bubble is transient', () => {
  assert.equal(isPersistentWaitingBubble('waiting', false), false);
  assert.equal(isPersistentWaitingBubble('waiting', undefined), false);
});

test('non-waiting bubbles are never persistent', () => {
  assert.equal(isPersistentWaitingBubble('permission', true), false);
  assert.equal(isPersistentWaitingBubble(null, true), false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd webview-ui && npx vitest run test/bubbleBehavior.test.ts`
Expected: FAIL — cannot find module `../src/office/engine/bubbleBehavior.js`.

- [ ] **Step 3: Write the helper**

Create `webview-ui/src/office/engine/bubbleBehavior.ts`:

```ts
import type { Character } from '../types.js';

/**
 * A "waiting" bubble is persistent — always full alpha, never auto-expires —
 * only when it represents the agent waiting on the USER (awaitingInput). The
 * turn-finished "Done" waiting bubble is transient: it counts down and fades.
 * Permission bubbles have their own (already-persistent) handling and are not
 * "waiting", so they return false here.
 *
 * Single source of truth so the renderer (alpha + whether to draw) and the
 * update loop (whether to run the expiry countdown) can never diverge.
 */
export function isPersistentWaitingBubble(
  bubbleType: Character['bubbleType'],
  waitingAwaitingInput: boolean | undefined,
): boolean {
  return bubbleType === 'waiting' && waitingAwaitingInput === true;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd webview-ui && npx vitest run test/bubbleBehavior.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Wire into the update loop (stop expiring the persistent bubble)**

In `webview-ui/src/office/engine/officeState.ts`, add the import (anywhere in the import block — lint will sort it):

```ts
import { isPersistentWaitingBubble } from './bubbleBehavior.js';
```

Replace the waiting-bubble countdown block (currently):

```ts
// Tick bubble timer for waiting bubbles
if (ch.bubbleType === 'waiting') {
  ch.bubbleTimer -= dt;
  if (ch.bubbleTimer <= 0) {
    ch.bubbleType = null;
    ch.bubbleTimer = 0;
  }
}
```

with:

```ts
// Tick the timer only for the transient "Done" waiting bubble. The
// awaiting-input bubble is persistent — it stays until the agent goes
// active again (which nulls bubbleType elsewhere).
if (
  ch.bubbleType === 'waiting' &&
  !isPersistentWaitingBubble(ch.bubbleType, ch.waitingAwaitingInput)
) {
  ch.bubbleTimer -= dt;
  if (ch.bubbleTimer <= 0) {
    ch.bubbleType = null;
    ch.bubbleTimer = 0;
  }
}
```

- [ ] **Step 6: Wire into the renderer (draw it, at full alpha)**

In `webview-ui/src/office/engine/renderer.ts`, add the import (lint will sort):

```ts
import { isPersistentWaitingBubble } from './bubbleBehavior.js';
```

Replace this block (currently):

```ts
if (!ch.bubbleType) continue;
// The green checkmark bubble only represents "done" (turn finished). The
// idle "Waiting for input" state communicates via its overlay label, not a
// bubble, so skip the bubble for it.
if (ch.bubbleType === 'waiting' && ch.waitingAwaitingInput) continue;

const sprite = ch.bubbleType === 'permission' ? BUBBLE_PERMISSION_SPRITE : BUBBLE_WAITING_SPRITE;

// Compute opacity: permission = full, waiting = fade in last 0.5s
let alpha = 1.0;
if (ch.bubbleType === 'waiting' && ch.bubbleTimer < BUBBLE_FADE_DURATION_SEC) {
  alpha = ch.bubbleTimer / BUBBLE_FADE_DURATION_SEC;
}
```

with:

```ts
if (!ch.bubbleType) continue;

const sprite = ch.bubbleType === 'permission' ? BUBBLE_PERMISSION_SPRITE : BUBBLE_WAITING_SPRITE;

// Opacity: permission and the awaiting-input waiting bubble render at full
// alpha (persistent). Only the transient "Done" waiting bubble fades out in
// its last BUBBLE_FADE_DURATION_SEC.
let alpha = 1.0;
if (
  ch.bubbleType === 'waiting' &&
  !isPersistentWaitingBubble(ch.bubbleType, ch.waitingAwaitingInput) &&
  ch.bubbleTimer < BUBBLE_FADE_DURATION_SEC
) {
  alpha = ch.bubbleTimer / BUBBLE_FADE_DURATION_SEC;
}
```

(The line `if (ch.bubbleType === 'waiting' && ch.waitingAwaitingInput) continue;` is removed — that was the skip that hid the awaiting-input bubble.)

- [ ] **Step 7: Verify the whole webview suite + build still pass**

Run: `cd webview-ui && npx vitest run && npm run build`
Expected: all tests PASS; `tsc -b && vite build` completes with no errors.

- [ ] **Step 8: Commit**

```bash
git add webview-ui/src/office/engine/bubbleBehavior.ts webview-ui/test/bubbleBehavior.test.ts webview-ui/src/office/engine/officeState.ts webview-ui/src/office/engine/renderer.ts
git commit -m "feat(office): persistent bubble for agents awaiting user input"
```

---

### Task 2: `idleWanderCandidates` helper (pure)

**Files:**

- Create: `webview-ui/src/office/engine/idleWander.ts`
- Create: `webview-ui/test/idleWander.test.ts`

**Interfaces:**

- Produces:
  - `manhattanDistance(aCol: number, aRow: number, bCol: number, bRow: number): number`
  - `idleWanderCandidates(seat: { col: number; row: number } | null, walkableTiles: Array<{ col: number; row: number }>, minDistance: number): Array<{ col: number; row: number }>`

- [ ] **Step 1: Write the failing test**

Create `webview-ui/test/idleWander.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd webview-ui && npx vitest run test/idleWander.test.ts`
Expected: FAIL — cannot find module `../src/office/engine/idleWander.js`.

- [ ] **Step 3: Write the helper**

Create `webview-ui/src/office/engine/idleWander.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd webview-ui && npx vitest run test/idleWander.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add webview-ui/src/office/engine/idleWander.ts webview-ui/test/idleWander.test.ts
git commit -m "feat(office): add idleWanderCandidates helper (stay N tiles from seat)"
```

---

### Task 3: Idle agents step away from the desk

**Files:**

- Modify: `webview-ui/src/constants.ts` (add `IDLE_MIN_DISTANCE_FROM_SEAT_TILES`)
- Modify: `webview-ui/src/office/engine/characters.ts` (imports; IDLE wander block, ~lines 163-208)
- Create: `webview-ui/test/characterIdleAway.test.ts`

**Interfaces:**

- Consumes: `idleWanderCandidates` (Task 2); `IDLE_MIN_DISTANCE_FROM_SEAT_TILES` (this task); existing `findPath`, `updateCharacter`, `createCharacter`, `Seat`, `CharacterState`, `Direction`, `TileType`.

- [ ] **Step 1: Add the constant**

In `webview-ui/src/constants.ts`, immediately after the `WANDER_MOVES_BEFORE_REST_MAX` line (currently `export const WANDER_MOVES_BEFORE_REST_MAX = 6;`), add:

```ts
/** While idle, an agent stays at least this many tiles (Manhattan) from its
 *  seat and mills there, instead of returning to sit at its desk. */
export const IDLE_MIN_DISTANCE_FROM_SEAT_TILES = 3;
```

- [ ] **Step 2: Write the failing integration test**

Create `webview-ui/test/characterIdleAway.test.ts`:

```ts
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
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd webview-ui && npx vitest run test/characterIdleAway.test.ts`
Expected: FAIL — the first test fails because the current FSM lets an idle agent walk back to its seat (destination distance 0 < 3), and/or `IDLE_MIN_DISTANCE_FROM_SEAT_TILES` import resolves only after Step 1.

- [ ] **Step 4: Wire the helper into the idle FSM**

In `webview-ui/src/office/engine/characters.ts`:

Add `IDLE_MIN_DISTANCE_FROM_SEAT_TILES` to the existing constants import (the `from '../../constants.js'` block), and add a new import (lint will sort):

```ts
import { idleWanderCandidates } from './idleWander.js';
```

Replace the idle wander block (currently — the `// Countdown wander timer` section through the end of the `CharacterState.IDLE` case):

```ts
// Countdown wander timer
ch.wanderTimer -= dt;
if (ch.wanderTimer <= 0) {
  // Check if we've wandered enough — return to seat for a rest
  if (ch.wanderCount >= ch.wanderLimit && ch.seatId) {
    const seat = seats.get(ch.seatId);
    if (seat) {
      const path = findPath(
        ch.tileCol,
        ch.tileRow,
        seat.seatCol,
        seat.seatRow,
        tileMap,
        blockedTiles,
      );
      if (path.length > 0) {
        ch.path = path;
        ch.moveProgress = 0;
        ch.state = CharacterState.WALK;
        ch.frame = 0;
        ch.frameTimer = 0;
        break;
      }
    }
  }
  if (walkableTiles.length > 0) {
    const target = walkableTiles[Math.floor(Math.random() * walkableTiles.length)];
    const path = findPath(ch.tileCol, ch.tileRow, target.col, target.row, tileMap, blockedTiles);
    if (path.length > 0) {
      ch.path = path;
      ch.moveProgress = 0;
      ch.state = CharacterState.WALK;
      ch.frame = 0;
      ch.frameTimer = 0;
      ch.wanderCount++;
    }
  }
  ch.wanderTimer = randomRange(WANDER_PAUSE_MIN_SEC, WANDER_PAUSE_MAX_SEC);
}
break;
```

with:

```ts
// Countdown wander timer
ch.wanderTimer -= dt;
if (ch.wanderTimer <= 0) {
  // Idle agents stay away from their desk: never return to sit while idle.
  // Pick a wander target that keeps ≥ IDLE_MIN_DISTANCE_FROM_SEAT_TILES
  // from the seat (best-effort in cramped layouts; free wander with no seat).
  const seat = ch.seatId ? seats.get(ch.seatId) : undefined;
  const seatPos = seat ? { col: seat.seatCol, row: seat.seatRow } : null;
  const candidates = idleWanderCandidates(
    seatPos,
    walkableTiles,
    IDLE_MIN_DISTANCE_FROM_SEAT_TILES,
  );
  if (candidates.length > 0) {
    const target = candidates[Math.floor(Math.random() * candidates.length)];
    const path = findPath(ch.tileCol, ch.tileRow, target.col, target.row, tileMap, blockedTiles);
    if (path.length > 0) {
      ch.path = path;
      ch.moveProgress = 0;
      ch.state = CharacterState.WALK;
      ch.frame = 0;
      ch.frameTimer = 0;
    }
  }
  ch.wanderTimer = randomRange(WANDER_PAUSE_MIN_SEC, WANDER_PAUSE_MAX_SEC);
}
break;
```

(This removes the "wanderCount ≥ wanderLimit → walk back and sit" branch and the unconstrained random target. `wanderCount`/`wanderLimit` remain on the type and in `createCharacter` — now unused by the idle path — which is harmless; leave them to keep this change minimal.)

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd webview-ui && npx vitest run test/characterIdleAway.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Verify the full webview suite + build**

Run: `cd webview-ui && npx vitest run && npm run build`
Expected: all tests PASS; `tsc -b && vite build` completes clean.

- [ ] **Step 7: Commit**

```bash
git add webview-ui/src/constants.ts webview-ui/src/office/engine/characters.ts webview-ui/test/characterIdleAway.test.ts
git commit -m "feat(office): idle agents step away from their desk instead of sitting"
```

---

### Task 4: Docs — record the new behavior + manual smoke

**Files:**

- Modify: `CLAUDE.md` (Characters + Speech bubbles notes)
- Modify: `e2e/README.md` (pre-release manual smoke)

- [ ] **Step 1: Update CLAUDE.md**

In `CLAUDE.md`, in the **Characters** paragraph (the FSM description that ends "…return to seat after `wanderLimit` moves"), append:

```
When a turn ends the character stands up and, while idle, stays ≥ `IDLE_MIN_DISTANCE_FROM_SEAT_TILES` (3) tiles from its seat (`idleWanderCandidates`), milling loosely rather than sitting back down; it walks back to the seat when it becomes active again.
```

In the **Speech bubbles** paragraph, replace the sentence describing the waiting bubble with:

```
Waiting bubble (green checkmark) is persistent while the agent is awaiting user input (`waitingAwaitingInput`), and transient (auto-fades ~2 s) for a finished turn ("Done"). The persist-vs-fade rule lives in `isPersistentWaitingBubble` (shared by the renderer and the update loop). Permission ("..." amber dots) stays until clicked/cleared.
```

- [ ] **Step 2: Add a manual-smoke bullet**

In `e2e/README.md`, under **"Visual + interactive polish"** in the pre-release manual smoke section, add:

```
- Leave an agent idle after a turn — it steps ≥3 tiles from its desk and mills there (doesn't sit back down); a persistent bubble sits above any agent awaiting your input; it walks back to its seat when it goes active again.
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md e2e/README.md
git commit -m "docs: note idle-away movement + persistent awaiting-input bubble"
```

---

## Self-Review

**Spec coverage:**

- Spec A (persistent awaiting-input bubble): Task 1 (helper + renderer un-skip + full alpha + update-loop no-expire). ✅
- Spec A "auto-clears when active": relies on existing go-active `bubbleType=null` paths; unchanged, noted in Task 1 Step 5 comment. ✅
- Spec B (idle ≥3 tiles, option B light wandering, no return-to-seat, walk back when active, no-seat passthrough, best-effort fallback): Task 2 (helper + all edge cases) + Task 3 (wire + integration tests incl. return-when-active). ✅
- Spec "extract pure helpers, unit test; canvas visuals → manual smoke": Tasks 1–3 tests + Task 4 manual-smoke bullet. ✅
- Out-of-scope items (new sprite, break room, server/protocol) — untouched. ✅

**Placeholder scan:** No TBD/TODO/"handle edge cases"/vague steps; every code step shows complete code and exact commands. ✅

**Type consistency:** `isPersistentWaitingBubble(bubbleType, waitingAwaitingInput)` — same signature in Task 1 create + both call sites. `idleWanderCandidates(seat, walkableTiles, minDistance)` and `manhattanDistance(aCol,aRow,bCol,bRow)` — defined in Task 2, consumed with matching arguments in Task 3 + tests. `Seat` literal uses the verified fields (`uid, seatCol, seatRow, facingDir, assigned`). `createCharacter(id, palette, seatId, seat)` matches the real signature. ✅
