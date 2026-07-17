# Idle-away movement + persistent "awaiting input" bubble

## Context

Two small, related quality-of-life changes to how characters behave when they
are **not actively working**, both isolated to the webview game layer
(`webview-ui/src/office/engine/`):

1. **Awaiting-input bubble** — an agent that is blocked waiting on the user
   should show a persistent speech bubble above its head, so you can spot it at a
   glance without hovering.
2. **Idle → step away from the desk** — when an agent goes idle (turn finished),
   it should leave its computer and mill about a few tiles away, rather than
   sitting back down at its desk.

Neither touches the server, protocol, or any Claude-surface work — this is pure
office-rendering / character-FSM behavior.

## Current behavior (verified)

**Bubbles** (`bubbleType: 'permission' | 'waiting' | null`, `bubbleTimer`,
`waitingAwaitingInput` on `Character`):

- `agentStatus: 'waiting'` → `officeState` sets `bubbleType='waiting'`,
  `bubbleTimer=WAITING_BUBBLE_DURATION_SEC` (2.0 s), `waitingAwaitingInput=<flag>`.
- `renderer.ts` (~line 744): **skips** the bubble entirely when
  `bubbleType === 'waiting' && waitingAwaitingInput` — the idle "Waiting for
  input" state communicates only via the `ToolOverlay` DOM label (hover/select,
  or always when "Always Show Labels" is on). The "Done" case (waiting,
  `!awaitingInput`) renders the green check and fades over the last
  `BUBBLE_FADE_DURATION_SEC` (0.5 s).
- `officeState.update()` (~line 1024): for `bubbleType === 'waiting'`, counts
  `bubbleTimer` down and clears `bubbleType` at ≤ 0 — so today the awaiting-input
  bubble state also self-clears after 2 s (invisibly, since it's not rendered).
- Permission bubbles (amber "…", `BUBBLE_PERMISSION_SPRITE`) render persistently
  until cleared. Going active nulls `bubbleType` (activity paths at ~lines 477,
  649, 680).

**Idle movement** (`characters.ts`):

- When an active agent's work ends, it transitions `ACTIVE → IDLE` and begins
  wandering: random BFS steps around the floor, `WANDER_PAUSE_*` between moves.
- After `wanderCount >= wanderLimit` (`WANDER_MOVES_BEFORE_REST_MIN..MAX` = 3–6),
  **if it has a seat, it walks back and sits down** to "rest," then wanders
  again. This return-to-desk is exactly the behavior we want to remove for idle
  agents.
- Becoming active again pathfinds the agent back to its seat and sits (TYPE/READ
  animation). Agents with no seat just wander.

Available bubble sprites: `BUBBLE_PERMISSION_SPRITE`, `BUBBLE_WAITING_SPRITE`
(green check), `BUBBLE_HEART_SPRITE` (pets). No new art is introduced.

## Design

### A. Persistent "awaiting input" bubble

Reuse `BUBBLE_WAITING_SPRITE`. Two changes:

- **`renderer.ts`** — stop skipping the awaiting-input bubble. Render it at full
  alpha (persistent, no fade). The "Done" bubble (`!waitingAwaitingInput`) keeps
  its existing tail-end fade.
- **`officeState.update()`** — run the `bubbleTimer` countdown-and-clear only for
  the "Done" waiting bubble (`bubbleType === 'waiting' && !waitingAwaitingInput`).
  For the awaiting-input bubble, leave it up; it is cleared by the existing
  go-active paths (which null `bubbleType`) and by the existing
  dismiss/fast-fade path.

Effect: any agent waiting on the user shows a persistent green-check bubble above
its head, no hover required — alongside the already-persistent amber permission
bubble (a distinct state). The `ToolOverlay` "Waiting for input" label is
unchanged and complementary.

Accepted nuance: "awaiting input" (persistent) and the brief "Done" flash share
the green-check sprite, distinguished by persist-vs-fade. A dedicated sprite is
possible later but is explicitly **out of scope** here.

### B. Idle → step away from the desk

- New constant `IDLE_MIN_DISTANCE_FROM_SEAT_TILES = 3` in
  `webview-ui/src/constants.ts` (Manhattan distance).
- In the idle/wander logic (`characters.ts`):
  - **Remove** the "`wanderCount >= wanderLimit` → return to seat and sit" branch
    for idle agents. An idle agent never sits back at its desk.
  - Constrain wander target selection to walkable tiles at Manhattan distance
    **≥ `IDLE_MIN_DISTANCE_FROM_SEAT_TILES`** from the agent's seat. If the agent
    is currently inside that radius (e.g. just stood up), its next step moves
    outward (toward increasing distance) until it clears the radius, then it
    mills loosely among the far tiles (option B — light wandering, chosen over
    "stand still").
- Becoming **active** again is unchanged: the agent pathfinds back to its seat
  and sits.
- Edge cases: an agent with no seat wanders freely as today; if no tile ≥ 3 away
  is reachable (cramped/blocked office), fall back to the farthest reachable
  walkable tile (best-effort, never stuck).

### Isolation / boundaries

Extract the two decision points as pure, independently testable helpers so the
FSM/render code stays thin:

- A bubble-persistence predicate: given `(bubbleType, waitingAwaitingInput)`,
  return whether the waiting bubble should persist (skip countdown) vs fade.
- An idle-target chooser: given `(seatPos, candidateTiles, minDistance, curPos)`,
  return the next wander target honoring the min-distance rule (with the
  best-effort fallback). Pure function over positions + walkable tiles.

## Testing

Bubbles and movement are canvas-drawn (not DOM), matching the pet-FSM precedent
that CLAUDE.md documents as "webview unit tests, not e2e."

- **Unit (webview):** the bubble-persistence predicate (awaiting → persist, done
  → fade/expire); the idle-target chooser (never picks a tile < minDistance when
  a farther one exists; steps outward from inside the radius; best-effort
  fallback when nothing ≥ minDistance is reachable; no-seat passthrough).
- **Not automated (manual smoke):** the actual on-canvas rendering of the
  persistent bubble and the idle-away animation — added to the pre-release manual
  smoke list. The existing DOM "Waiting for input" `ToolOverlay` label continues
  to provide an e2e-observable signal for the awaiting-input state.

## Out of scope

- A dedicated/distinct sprite for "awaiting input" (green-check reuse for now).
- Any "break room" / designated-destination concept (explicitly dropped in
  favor of the simpler "≥ N tiles from the seat" rule).
- Server, protocol, persistence, or Claude-surface changes.

## Constants touched

- `webview-ui/src/constants.ts`: add `IDLE_MIN_DISTANCE_FROM_SEAT_TILES = 3`.
  Reuse existing `WANDER_PAUSE_*`, `BUBBLE_FADE_DURATION_SEC`,
  `WAITING_BUBBLE_DURATION_SEC`.
