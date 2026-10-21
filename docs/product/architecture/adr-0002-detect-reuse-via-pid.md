# ADR-0002 — Detect instance reuse via `ServerConfig.pid`, exit-on-reuse

- **Status**: Accepted (2026-07-17)
- **Feature**: one-click-viewer-launch
- **Wave**: DESIGN

## Context

`PixelAgentsServer.start()` (`server/src/server.ts:82-91`) already implements
multi-instance safety: it prunes a PID-keyed registry (`~/.pixel-agents/servers/*.json`,
liveness via `process.kill(pid,0)`) and, when a capability-matched (`servesSpa`)
live server exists, **returns that server's `ServerConfig` instead of starting a
new listener**. The returned config carries the _other_ process's `pid` and
`port`.

The current CLI ignores this: after `start()` it unconditionally runs scanners,
installs hooks, and holds the process open on SIGINT — even if `start()` reused
someone else's server (in which case this process serves nothing).

## Decision

In `cli.ts main()`, immediately after `start()`, compare `config.pid` to
`process.pid`:

- **Reused** (`config.pid !== process.pid`): print `Reusing running instance`,
  open the browser to the returned port (unless `--no-open`), then **exit 0**.
  Do not start scanners, do not install hooks, do not hold open — the serving
  process owns those.
- **Fresh start** (`config.pid === process.pid`): unchanged flow (hooks,
  scanners, hold-open), plus the new auto-open + status line.

This makes re-running idempotent (US-3 / AC3.1–3.3) with **no new reuse gate** —
the CLI consumes the existing registry decision.

## Consequences

- Slice-02 shrinks to a single branch in `main()`; the registry/liveness logic is
  untouched.
- `--port <n>` explicitly requested still starts a new server on that port
  (start() honors an explicit port), preserving AC3.3.
- Health endpoint is **not** used for reuse (registry PID-liveness supersedes it);
  note that `/api/health` returns `{ status, uptime, pid }`, not `{ port, version }`.

## Alternatives considered

- A new pre-`start()` `server.json` probe in the CLI — rejected: duplicates the
  registry reuse logic and risks divergence (single vs multi-instance files).
