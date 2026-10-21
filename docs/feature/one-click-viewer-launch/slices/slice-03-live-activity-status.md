# Slice 03 — Live-activity status line + `--no-hooks`

**Goal**: one clear stdout line tells the user whether live Claude activity is
wired up, and `--no-hooks` is a documented opt-out.

**Stories**: US-4 · **Job**: launch-viewer-effortlessly

## IN scope

- After the existing hook-install attempt, print exactly one status line:
  `Live Claude activity: ON (hooks installed)` OR
  `Live Claude activity: file-watch mode` + a one-line manual hint.
- `--no-hooks` flag in `parseArgs` (maps to existing `hooksEnabled=false`) +
  `--help` text.
- On hook-install failure: report file-watch mode, keep serving (already the
  behavior — this slice makes it legible).

## OUT scope

- Any change to how hooks are actually installed (reuse `installHooks`).
- Auto-open / reuse (slices 01–02).

## Learning hypothesis

Confirms: users can tell at a glance whether to expect real-time movement.
Disproves (if it fails): that the CLI can reliably distinguish "hooks ON" from
"file-watch fallback" at startup — if it can't, the status line would lie.

## Acceptance criteria

- AC4.1–AC4.3 from feature-delta.md.

## Dependencies

- Existing `installHooks` / `hooksEnabled` setting + try/catch in `cli.ts`.

## Effort / reference class

~0.25 day. Reference class: existing startup logging in `cli.ts`.

## Dogfood moment

Same day: run with hooks on and with `--no-hooks`; confirm the two distinct
status lines.

## Production data

Real hook-install path against a real `~/.claude/settings.json` (isolated HOME in
e2e).
