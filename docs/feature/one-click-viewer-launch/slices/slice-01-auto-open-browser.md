# Slice 01 — Auto-open the browser on launch

**Goal**: `npx pixel-agents` (no flags) opens the default browser to the running
loopback viewer URL; `--no-open` and open-failure degrade gracefully.

**Stories**: US-1, US-2 · **Job**: launch-viewer-effortlessly

## IN scope

- After `server.start()` resolves the bound port, open the default browser to
  `http://127.0.0.1:<port>` (loopback even if `--host 0.0.0.0`).
- Reuse the existing per-OS launcher seam (`server/src/appFocus.ts` `open`/`start`/
  `xdg-open`, injectable spawn) rather than adding a new dependency.
- `--no-open` flag in `parseArgs` + `--help` text.
- Print an "Opened <url>" line; on open failure print the URL under
  "Open this in your browser:" and keep serving (no throw, exit 0).

## OUT scope

- Instance reuse (slice 02).
- Live-activity status line (slice 03).

## Learning hypothesis

Confirms: a single command can deliver a visible office with zero manual steps.
Disproves (if it fails): that the existing `appFocus` spawn seam is reusable for
browser-open across macOS/Linux/Windows — if it isn't, we need a dedicated opener.

## Acceptance criteria

- AC1.1–AC1.3, AC2.1–AC2.3 from feature-delta.md.

## Dependencies

- `appFocus.ts` launcher; `server.start()` returning `{ port }`.

## Effort / reference class

~0.5 day. Reference class: prior `appFocus`/`claudeAppFocus` per-OS launch work
(already unit-tested with injectable spawn).

## Dogfood moment

Same day: run `npx pixel-agents` locally, confirm the office opens; run
`--no-open` and confirm the URL prints and no browser launches.

## Production data

Real browser process, real bound port — not synthetic. e2e asserts the injected
spawn seam is invoked with a loopback URL.
