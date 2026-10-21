# Architecture Brief — Pixel Agents (SSOT)

> Bootstrapped by the DESIGN wave for feature `one-click-viewer-launch` (2026-07-17).
> Each architect owns its section. Extend; do not fork per feature.

## Application Architecture

### Standing context (existing, unchanged)

Pixel Agents is a **modular monolith with strict layering** and ports-and-adapters
seams (see root `CLAUDE.md`): `core/` (protocol) → `server/` (runtime + Fastify)
→ `adapters/vscode/`; `webview-ui/` depends only on `core/`. The standalone
surface is the `pixel-agents` CLI (`server/src/cli.ts`) composing `AgentRuntime`

- `PixelAgentsServer` + `FileStateAdapter`.

Relevant existing seams this feature builds on:

- **Driven port — OS URI opener**: `server/src/appFocus.ts` `openUri(uri, {platform, spawn})` — best-effort, injectable, never throws.
- **Server instance registry**: `PixelAgentsServer.start()` (`server/src/server.ts:82-91`) prunes a PID-keyed registry (`~/.pixel-agents/servers/*.json`) and _reuses_ a capability-matched (`servesSpa`) live server, returning its `ServerConfig`; else starts its own.
- **Liveness**: `isProcessRunning(pid)` (`server.ts:283`) via `process.kill(pid, 0)`; `readAndPruneRegistry()` (`server.ts:220`).
- **`ServerConfig`** (`server/src/serverConfig.ts:6-21`): `{ port, pid, token, debugLog?, startedAt, servesSpa, protocol }`. Note: **no `host` field** — the browser URL is always loopback (`127.0.0.1`), which is why the viewer-URL builder needs only the port (DD4).

### This feature's application-level shape

`one-click-viewer-launch` is a **thin behavior change in the CLI driving adapter
only**. No new bounded context, no protocol/AsyncAPI change, no new HTTP route.
The CLI gains:

1. Two flags (`--no-open`, `--no-hooks`) in `parseArgs`.
2. A **reuse branch** in `main()`: after `start()`, compare `config.pid` to
   `process.pid`. If they differ, an existing instance was reused → print
   `Reusing running instance`, open the browser, and **exit 0** (skip scanners /
   hold-open, which belong to the process that actually serves).
3. An **auto-open** step: unless `--no-open`, call `openUri()` with the loopback
   viewer URL. Always print the URL regardless (graceful degradation by
   construction — `openUri` never throws, so a missing browser cannot fail the
   launch).
4. A **live-activity status line** derived from the outcome of the existing
   hook-install try/catch.

The only new logic is a tiny inline URL builder (loopback host + `config.port`)
and a testability seam so `main()` can accept an injected opener for unit tests.

See ADR-0001..0003 for the significant decisions.
