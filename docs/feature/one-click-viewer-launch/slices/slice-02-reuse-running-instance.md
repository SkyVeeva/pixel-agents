# Slice 02 — Re-launch reuses a running instance

**Goal**: running `npx pixel-agents` again opens the already-running office
instead of starting a second server.

**Stories**: US-3 · **Job**: reopen-without-duplicates

## IN scope

- Before starting a server, read `~/.pixel-agents/server.json` and check PID
  liveness (reuse existing liveness logic used by the multi-window path).
- If a live instance exists AND no explicit `--port` override is given: skip
  `server.start()`, print `Reusing running instance`, and open its loopback URL
  (via slice-01's open path).
- Dead/absent/corrupt `server.json` → fall through to a fresh start (unchanged).

## OUT scope

- Auto-open mechanics (slice 01 — this slice consumes them).
- Killing/replacing a stale server (existing behavior untouched).

## Learning hypothesis

Confirms: re-running is idempotent and safe (one live server for N runs).
Disproves (if it fails): that `server.json` liveness is trustworthy enough to
gate reuse — if PID checks are flaky, reuse would open dead URLs.

## Acceptance criteria

- AC3.1–AC3.3 from feature-delta.md.

## Dependencies

- Slice 01 (open path); `server.json` schema + PID-liveness helper; `/api/health`
  as an optional confirmation probe.

## Effort / reference class

~0.5 day. Reference class: existing "second server detects an existing
server.json and reuses or replaces it based on PID liveness" logic.

## Dogfood moment

Same day: run the command twice; assert one PID and a "Reusing" message on the
second run.

## Production data

Real `server.json` written by a real first instance; real PID checks.
