# Feature Delta — one-click-viewer-launch

> Wave output. Lean mode (`density=lean`, `expansion_prompt=ask-intelligent`).
> Tier-1 [REF] sections only; Tier-2 expansions are available on request via
> `--expand <id>` (catalog in the nw-discuss skill).

---

## Wave: DISCUSS / [REF] Persona

- **Primary persona**: `dev-dana` (they/them) — a developer already working in
  Claude Code who wants an ambient glance at the pixel office without breaking
  flow or fiddling with setup. Full profile: `docs/product/personas/dev-dana.yaml`.

## Wave: DISCUSS / [REF] JTBD

- **Primary job** (`launch-viewer-effortlessly`, opportunity gap 6/9): _When I'm
  working in Claude Code and want to see my agents come alive, I want to launch
  the viewer with a single command and have it just work, so I can watch agent
  activity without fiddling with ports, hooks, or URLs._
- **Secondary job** (`reopen-without-duplicates`, gap 3): re-running the launch
  should reuse a live instance rather than spawn a duplicate.
- Full analysis + four forces + scores: `docs/product/jobs.yaml`.

## Wave: DISCUSS / [REF] Current State ("Before")

Grounded in `server/src/cli.ts` (read 2026-07-17):

- `npx pixel-agents` loads assets, starts a Fastify server, **auto-installs Claude
  hooks on startup** (setting `hooksEnabled` defaults on), scans sessions, and
  **prints** `Pixel Agents server running at http://127.0.0.1:<port>`.
- Port is an **OS-assigned ephemeral port** unless `--port` is passed → the URL
  changes every run.
- It **does not open a browser** and **does not reuse** an already-running
  instance (`~/.pixel-agents/server.json` exists and is PID-aware, but the launch
  path always starts a new server).

**Therefore the real friction is not hooks** (already automatic) — it is:
(1) manual copy-paste of the URL, (2) an unpredictable port, (3) duplicate
servers on re-run. This feature closes those three gaps.

## Wave: DISCUSS / [REF] Locked Decisions

| ID  | Decision                                                                                                                                                                                                                                  | Verdict |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| D1  | The single entry point is `npx pixel-agents` with **no required flags**; the default behavior is the "one-click" behavior (start → open browser).                                                                                         | LOCKED  |
| D2  | **Auto-open the default browser** to the viewer on launch. Opt out with `--no-open`. The opened URL is always a **loopback** URL (`127.0.0.1`) even when bound to a wildcard host.                                                        | LOCKED  |
| D3  | **Reuse a live instance**: if `~/.pixel-agents/server.json` points to an alive PID, do not start a second server — just open the browser to it. Dead PID → start fresh (existing liveness logic).                                         | LOCKED  |
| D4  | **Hooks stay auto-ensured** (existing behavior). No new consent prompt is introduced by this feature; `--no-hooks` (mapping to the existing `hooksEnabled=false`) remains the opt-out. Auto-install stays idempotent, logged, reversible. | LOCKED  |
| D5  | **Graceful degradation, never hard-fail the launch**: if the browser can't open (headless/SSH/CI) or a hook step fails, print the URL/hint prominently and keep serving.                                                                  | LOCKED  |
| D6  | **Out of scope**: a desktop / menu-bar / double-click app (the user deselected it). Terminal command only.                                                                                                                                | LOCKED  |

## Wave: DISCUSS / [REF] User Stories

### US-1 — One command opens the live viewer _(job: launch-viewer-effortlessly)_

As Dev Dana, I run one command and the pixel office opens in my browser,
already connected to Claude activity.

**### Elevator Pitch**
Before: I run `npx pixel-agents`, then hunt for the URL in stdout and open it myself.
After: run `npx pixel-agents` → the default browser opens to the running office and prints `Opened http://127.0.0.1:<port>`.
Decision enabled: I can immediately see whether my agents are active and keep working, deciding nothing more.

**Acceptance criteria**

- AC1.1: Running `npx pixel-agents` with no flags starts the server AND opens the default browser to the loopback viewer URL.
- AC1.2: stdout shows a single clear "Opened <url>" line (in addition to the existing "running at" line).
- AC1.3: The opened URL uses `127.0.0.1` even when `--host 0.0.0.0` is passed.

### US-2 — Headless / opt-out is graceful _(job: launch-viewer-effortlessly)_

As Dev Dana on a remote/headless box, launch must not fail trying to open a browser.

**### Elevator Pitch**
Before: n/a (auto-open didn't exist).
After: run `npx pixel-agents --no-open` (or on a headless box) → no browser is attempted; stdout prints the URL prominently under an "Open this in your browser:" heading.
Decision enabled: I copy the URL and open it wherever I like, with no error noise.

**Acceptance criteria**

- AC2.1: `--no-open` suppresses the browser launch; the server still starts and prints the URL.
- AC2.2: If auto-open is attempted and fails (no browser / non-zero exit), the launch does NOT error; it prints the URL and continues serving.
- AC2.3: `--help` documents `--no-open`.

### US-3 — Re-launch reuses a running instance _(job: reopen-without-duplicates)_

As Dev Dana, running the command again opens the office I already have, not a second server.

**### Elevator Pitch**
Before: running `npx pixel-agents` twice starts two servers on two ports.
After: run `npx pixel-agents` again → it detects the live instance and prints `Reusing running instance` then opens the existing URL; no second server starts.
Decision enabled: I trust re-running is safe and I'm not leaking background processes.

**Acceptance criteria**

- AC3.1: When `server.json` names an alive PID, no new server process is started; the existing URL is opened.
- AC3.2: When `server.json` names a dead PID (or is absent/corrupt), a fresh server starts (existing behavior preserved).
- AC3.3: Passing an explicit `--port` that differs from the running instance still starts a new server on that port (explicit intent overrides reuse).

### US-4 — Hooks are confirmed, not a mystery _(job: launch-viewer-effortlessly)_

As Dev Dana, I want a one-line confirmation that live activity is wired up.

**### Elevator Pitch**
Before: hooks install silently; if nothing moves I don't know why.
After: run `npx pixel-agents` → stdout prints `Live Claude activity: ON (hooks installed)` or, on `--no-hooks`/failure, `Live Claude activity: file-watch mode` with a one-line hint.
Decision enabled: I know whether to expect real-time movement, and how to fix it if not.

**Acceptance criteria**

- AC4.1: A single status line reports whether hook-based live activity is active.
- AC4.2: On hook-install failure the line reports fallback mode plus a one-line manual hint; launch continues.
- AC4.3: `--no-hooks` sets the fallback mode line and skips install (maps to existing `hooksEnabled=false`).

## Wave: DISCUSS / [REF] Outcome KPIs

| KPI                                         | Target                                          | Measurement                                                                          |
| ------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------ |
| Manual steps from command to visible office | **0** (down from ≥1: copy/open URL)             | Manual walkthrough; automated e2e assertion that browser-open is invoked.            |
| Duplicate servers after N re-runs           | **1** live server for N sequential no-flag runs | e2e: run twice, assert one server PID + reuse message.                               |
| Launch failure rate on headless             | **0 hard failures**                             | e2e/unit: simulate open failure → server still serving, exit code 0 for `--no-open`. |
| Time-to-office (warm assets)                | ≤ current start time + browser open latency     | Log timestamps start→open.                                                           |

## Wave: DISCUSS / [REF] Walking Skeleton Strategy

**Strategy C — feature slice on a mature system.** The standalone server + SPA is
already a working walking skeleton; this feature adds thin vertical slices
(open, reuse, degrade) on top. No new skeleton needed.

## Wave: DISCUSS / [REF] Driving Ports (inbound surfaces)

- **Primary**: the `pixel-agents` CLI command (`server/src/cli.ts` `parseArgs` +
  `main`). New flags: `--no-open`, `--no-hooks` (the latter maps to existing
  `hooksEnabled`).
- **Reused, no new HTTP surface**: `~/.pixel-agents/server.json` discovery and
  `GET /api/health` liveness (already exist) drive instance reuse.
- No webview/protocol (AsyncAPI) changes required.

## Wave: DISCUSS / [REF] Pre-requisites

- None on prior nWave waves (this bootstraps SSOT).
- Depends on existing runtime: `server.json` discovery, `installHooks`, health
  endpoint, `server.start()` returning the bound port.

## Wave: DISCUSS / [REF] Out of Scope

- Desktop / menu-bar / double-click application (D6).
- New GUI installer or packaging beyond the existing npm/npx distribution.
- Changes to the VS Code extension launch path (it already renders in-panel).
- Multi-user / remote-hosting concerns beyond loopback.

## Wave: DISCUSS / [REF] Definition of Done

1. All four user stories' ACs pass via automated tests (unit + e2e where a browser-open seam is observable).
2. `npx pixel-agents` (no flags) opens the browser to the loopback viewer URL.
3. `--no-open` and `--no-hooks` implemented and documented in `--help`.
4. Re-running with no flags reuses a live instance (no duplicate server).
5. Browser-open failure and hook-install failure never crash the launch (exit 0 on the `--no-open`/headless happy path; server keeps serving).
6. Status line reports live-activity mode (hooks vs file-watch).
7. Existing standalone e2e suite still green; new coverage added for auto-open/reuse.
8. No AsyncAPI/protocol drift; `npm run compile` clean.
9. SSOT updated (`docs/product/{vision.md,jobs.yaml,personas/,journeys/}`) and slice briefs present.

## Wave: DISCUSS / [REF] Scope Assessment

**PASS (right-sized).** 4 user stories, 1 bounded context (standalone CLI),
1 technology surface, ~2 integration points (server.json, browser-open). Below
all oversize heuristics. Sliced into 3 thin end-to-end slices (below).

## Wave: DISCUSS / [REF] Wave Decisions Summary

- Feature type: **cross-cutting** (CLI tooling + browser UX), leaning tooling.
- Primary need: turn `npx pixel-agents` into a true one-command "open the live
  office" experience; the missing piece is auto-open + instance reuse + graceful
  degradation (hooks are already automatic).
- Constraints: loopback-only URL; anything touching `~/.claude` stays idempotent,
  logged, reversible; never hard-fail the launch.
- Upstream changes: none (greenfield SSOT bootstrap).

## Wave: DISCUSS / [REF] Definition of Ready (validation)

| #   | DoR item                                   | Status | Evidence                                                            |
| --- | ------------------------------------------ | ------ | ------------------------------------------------------------------- |
| 1   | Persona defined                            | ✅     | `personas/dev-dana.yaml`                                            |
| 2   | Job traceability (every story → job_id)    | ✅     | US-1/2/4→launch-viewer-effortlessly; US-3→reopen-without-duplicates |
| 3   | Stories in LeanUX format w/ elevator pitch | ✅     | US-1..US-4 above                                                    |
| 4   | ACs testable & unambiguous                 | ✅     | AC*.* reference exact command/output                                |
| 5   | Journey mapped w/ emotional arc            | ✅     | `journeys/one-click-launch.yaml` (upward arc)                       |
| 6   | Error paths identified                     | ✅     | journey error_paths + US-2/US-3 ACs                                 |
| 7   | Outcome KPIs w/ numeric targets            | ✅     | KPI table above                                                     |
| 8   | Out-of-scope explicit                      | ✅     | Out of Scope section                                                |
| 9   | Slices ≤1 day, each w/ learning hypothesis | ✅     | `slices/slice-01..03-*.md`                                          |

---

## Wave: DESIGN / [REF] Scope, Paradigm & Pattern

- **Design scope**: Application / components (nw-solution-architect, propose mode).
- **Paradigm**: unchanged — the project's standalone code is idiomatic TS/OOP+functional-utility; this feature adds pure functions + one CLI branch. No paradigm decision needed (not written to CLAUDE.md).
- **Pattern**: modular monolith + ports-and-adapters (existing). This feature is a **behavior change in the CLI driving adapter only** — no new context, no protocol/HTTP change.
- Full narrative: `docs/product/architecture/brief.md` (`## Application Architecture`) + ADR-0001..0003.

## Wave: DESIGN / [REF] DDD List (design decisions)

| ID  | Decision                                                                                               | Rationale (one line)                                                                                             |
| --- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| DD1 | Reuse `appFocus.openUri` for browser launch; no new opener/dependency                                  | Per-OS logic + test seam already exist; never-throws satisfies AC2.2 by construction (ADR-0001)                  |
| DD2 | Detect reuse via `config.pid !== process.pid`; on reuse print "Reusing running instance", open, exit 0 | `start()` already reuses a live capability-matched server; CLI just consumes the result — no new gate (ADR-0002) |
| DD3 | Always print loopback URL; auto-open is best-effort/additive                                           | Cannot detect detached-open success; always-print keeps launch un-failable (ADR-0003)                            |
| DD4 | Coerce opened URL to `127.0.0.1` even when bound to `0.0.0.0`                                          | Wildcard host isn't directly openable (AC1.3)                                                                    |
| DD5 | Add `--no-open` and `--no-hooks` to `parseArgs` + `--help`; `--no-hooks` maps to `hooksEnabled=false`  | Opt-outs for headless/CI and settings-averse users (AC2.1, AC4.3)                                                |
| DD6 | Live-activity status line derived from the existing hook-install try/catch result                      | Reuses existing install branch; adds one legible line (AC4.1–4.2)                                                |
| DD7 | Inject the opener into `main()` (seam); e2e asserts the stdout "Opened <url>" line                     | Real browser launch isn't assertable; visible-outcome discipline (ADR-0003)                                      |

## Wave: DESIGN / [REF] Component Decomposition

| Component             | Path                                      | Change                                                                             |
| --------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------- |
| CLI arg parser        | `server/src/cli.ts` `parseArgs` (:42)     | EXTEND — add `--no-open`, `--no-hooks`; update `--help` (:67-69)                   |
| CLI main flow         | `server/src/cli.ts` `main()`              | EXTEND — reuse branch (pid compare), auto-open call, status line, always-print URL |
| Viewer-URL builder    | `server/src/cli.ts` (inline pure fn)      | CREATE NEW (trivial, ~5 LOC) — loopback host + `config.port`                       |
| Browser opener        | `server/src/appFocus.ts` `openUri` (:53)  | REUSE                                                                              |
| Server instance reuse | `server/src/server.ts` `start()` (:82-91) | REUSE (unchanged)                                                                  |

## Wave: DESIGN / [REF] Driving & Driven Ports

**Driving (inbound)**: the `pixel-agents` CLI command (`parseArgs` → `main`).
No new webview/HTTP driving surface.

**Driven (outbound / side-effects)**:

| Driven port                | Adapter                                                                     | Notes                             |
| -------------------------- | --------------------------------------------------------------------------- | --------------------------------- |
| OS URI open                | `appFocus.openUri` → detached `spawn`                                       | best-effort; injectable for tests |
| Server registry / liveness | `server.start()` → `~/.pixel-agents/servers/*.json` + `process.kill(pid,0)` | reuse decision (unchanged)        |
| Hook install               | `claudeProvider.installHooks` → `~/.claude/settings.json`                   | existing; idempotent/reversible   |

## Wave: DESIGN / [REF] Technology Choices

- Node.js + TypeScript (Node16 resolution, `.js` import extensions), esbuild CLI
  bundle — **all existing**; no new runtime deps, no version pins introduced.

## Wave: DESIGN / [REF] Reuse Analysis

| Existing Component                          | File                              | Overlap                                                   | Decision       | Justification                                                                                            |
| ------------------------------------------- | --------------------------------- | --------------------------------------------------------- | -------------- | -------------------------------------------------------------------------------------------------------- |
| `openUri` / `uriOpenCommand`                | `server/src/appFocus.ts:26-64`    | Open a URI via OS handler; injectable spawn; never-throws | **REUSE**      | Exactly the browser-open need; new opener would duplicate per-OS logic + test seam                       |
| `parseArgs`                                 | `server/src/cli.ts:42`            | CLI flag parsing                                          | **EXTEND**     | Add two flag branches (~10 LOC) + help text; a new parser is unwarranted                                 |
| `start()` registry reuse                    | `server/src/server.ts:82-91`      | Reuse-or-start via PID registry                           | **REUSE**      | Instance reuse already implemented; CLI consumes `ServerConfig`                                          |
| `isProcessRunning` / `readAndPruneRegistry` | `server/src/server.ts:220-289`    | PID liveness + dead-entry prune                           | **REUSE**      | Liveness handled inside `start()`; no separate probe                                                     |
| `ServerConfig`                              | `server/src/serverConfig.ts:6-21` | `port`/`pid`/`token`                                      | **REUSE**      | `pid !== process.pid` distinguishes reuse from fresh start                                               |
| `/api/health`                               | `server/src/httpServer.ts:97-103` | Liveness endpoint                                         | **NOT USED**   | Registry PID-liveness supersedes; returns `{status,uptime,pid}` (no port/version)                        |
| Viewer-URL builder                          | (new, inline in `cli.ts`)         | Build loopback browser URL                                | **CREATE NEW** | No existing helper coerces host→loopback + appends port; trivial (~5 LOC), too small to warrant a module |

**Zero unjustified CREATE NEW**: the only new code is a ~5-LOC inline URL builder.

## Wave: DESIGN / [REF] Decisions Table

| DDD-N | Decision                                                 |
| ----- | -------------------------------------------------------- |
| DDD-1 | Browser launch via reused `openUri`                      |
| DDD-2 | Reuse detection via `config.pid` compare + exit-on-reuse |
| DDD-3 | Always-print URL; best-effort additive open              |
| DDD-4 | Loopback URL coercion                                    |
| DDD-5 | `--no-open` / `--no-hooks` flags                         |
| DDD-6 | Live-activity status line from hook-install result       |
| DDD-7 | Injected opener seam for testability                     |

## Wave: DESIGN / [REF] Open Questions (deferred to DISTILL/DELIVER)

- **OQ1**: exact stdout wording/format for the three lines ("Opened …", "Reusing running instance", "Live Claude activity: …") — finalize in DISTILL acceptance tests.
- **OQ2**: whether e2e can meaningfully assert auto-open beyond the stdout line (e.g. via an injected `BROWSER`/spawn stub in the standalone fixture) — decide in DISTILL.
- **OQ3**: should `--no-open` also apply implicitly in CI (`process.env.CI`)? Default: no (explicit flag only) unless DISTILL says otherwise.

## Wave: DESIGN / [REF] Slice Refinement (back-propagation)

Slice-02 ("reuse running instance") is **thinner than DISCUSS assumed**: reuse is
already implemented in `start()`, so the slice is a single `main()` branch, not a
new gate. Slice briefs remain valid; effort for slice-02 drops to ~0.25 day.
No user-story/AC changes required, so no `design/upstream-changes.md` is produced.

## Wave: DESIGN / [REF] Wave Decisions Summary

- **Pattern**: modular monolith + ports-and-adapters (existing); change confined to the CLI driving adapter.
- **Key components**: `cli.ts` (`parseArgs` + `main`) EXTEND; `appFocus.openUri` + `server.start()` REUSE.
- **Tech stack**: existing Node/TS/esbuild; no new dependencies or version pins.
- **Constraints**: loopback-only opened URL; never hard-fail the launch; `~/.claude` writes stay idempotent/reversible.
- **Upstream changes**: none (slice-02 refinement is internal to DESIGN).
- **Handoff**: → DEVOPS (KPIs; minimal — no infra) and/or DISTILL (acceptance tests).

---

## Wave: DISTILL / [REF] Language & Framework

TypeScript. Acceptance tests use the project's real frameworks (no Gherkin/pytest
in this repo): **vitest** for the unit-layer decision logic and **vitest
subprocess** (real `dist/cli.js`) for the driving-adapter walking skeleton —
matching the existing `server/__tests__/cli.test.ts` convention. Reconciliation:
DISCUSS D1–D6 vs DESIGN DD1–DD7 → **0 contradictions**.

## Wave: DISTILL / [REF] Scenario List with Tags

| Scenario                                            | File                                    | Tags                                              | AC          |
| --------------------------------------------------- | --------------------------------------- | ------------------------------------------------- | ----------- |
| parseLaunchFlags defaults open/hooks true           | `server/__tests__/launchViewer.test.ts` | `@US-1` `@driving_port`                           | AC1.1       |
| parseLaunchFlags `--no-open`                        | launchViewer.test.ts                    | `@US-2`                                           | AC2.1       |
| parseLaunchFlags `--no-hooks`                       | launchViewer.test.ts                    | `@US-4`                                           | AC4.3       |
| resolveViewerUrl loopback                           | launchViewer.test.ts                    | `@US-1` `@error`                                  | AC1.3/DD4   |
| planLaunch fresh: open + hold                       | launchViewer.test.ts                    | `@US-1`                                           | AC1.1/AC1.2 |
| planLaunch reused: print + exit                     | launchViewer.test.ts                    | `@US-3`                                           | AC3.1       |
| planLaunch `--no-open`: print URL                   | launchViewer.test.ts                    | `@US-2`                                           | AC2.1       |
| describeLiveActivity ON / file-watch                | launchViewer.test.ts                    | `@US-4`                                           | AC4.1/AC4.2 |
| CLI `--no-open` prints URL, serves                  | `server/__tests__/cliLaunch.test.ts`    | `@walking_skeleton` `@driving_adapter` `@real-io` | AC2.1/AC2.2 |
| CLI default prints "Opened <url>"                   | cliLaunch.test.ts                       | `@walking_skeleton` `@driving_adapter`            | AC1.1/AC1.2 |
| CLI re-launch reuses instance                       | cliLaunch.test.ts                       | `@driving_adapter` `@US-3`                        | AC3.1       |
| CLI explicit `--port` overrides reuse (new server)  | cliLaunch.test.ts                       | `@driving_adapter` `@US-3`                        | AC3.3       |
| CLI browser-open FAILURE prints URL + keeps serving | cliLaunch.test.ts                       | `@walking_skeleton` `@driving_adapter` `@US-2`    | AC2.2       |
| CLI `--help` documents `--no-open` / `--no-hooks`   | cliLaunch.test.ts                       | `@driving_adapter` `@US-2` `@US-4`                | AC2.3       |

All ATs are scaffolded **RED** (`it.skip`, per ADR-025); DELIVER un-skips one at a
time. Pre-DELIVER classification: **10/10 unit ATs correct RED** (see
`distill/red-classification.md`). Three subprocess ATs (AC2.2, AC2.3, AC3.3) were
added after the Final Wave Review Gate (Sentinel findings) and are pending DELIVER.
**Every AC (AC1.1–AC4.3) now has at least one scenario.**

## Wave: DISTILL / [REF] WS Strategy (Architecture of Reference)

Per the project's ATDD Infrastructure Policy (`docs/architecture/atdd-infrastructure-policy.md`,
bootstrapped this wave): driving port (CLI) = real `dist/cli.js` subprocess;
driven-internal (server registry, hook FS) = real FS under isolated `HOME`;
driven-external (OS browser open) = injected `spawn` / assert stdout `Opened <url>`
line (a real browser launch is not assertable — ADR-0003). One walking-skeleton
scenario per the DISTILL WS rule: the `--no-open` subprocess scenario closes the
end-to-end loop through the real CLI (`@walking_skeleton @driving_adapter`).

## Wave: DISTILL / [REF] Adapter Coverage (Mandate 6)

| Adapter                                                | @real-io scenario | Covered by                                                                                                              |
| ------------------------------------------------------ | ----------------- | ----------------------------------------------------------------------------------------------------------------------- |
| OS browser open (`appFocus.openUri`)                   | YES (proxy)       | cliLaunch `--no-open` asserts printed URL; unit asserts `planLaunch.shouldOpen`; DELIVER adds injected-opener assertion |
| Server registry / reuse (`start()` + `servers/*.json`) | YES               | cliLaunch re-launch reuse scenario (real FS under isolated HOME)                                                        |
| Hook install (`~/.claude/settings.json`)               | YES (existing)    | pre-existing `cli.test.ts` "installs bundled hook script"; `describeLiveActivity` reports the outcome                   |

Zero `NO — MISSING` rows.

## Wave: DISTILL / [REF] Scaffolds (Mandate 7)

| Scaffold                                                                                                    | Marker                             | Bodies                                                                   |
| ----------------------------------------------------------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------ |
| `server/src/launchViewer.ts` (`parseLaunchFlags`, `resolveViewerUrl`, `describeLiveActivity`, `planLaunch`) | `export const __SCAFFOLD__ = true` | throw `Error('Not yet implemented -- RED scaffold …')` → RED, not BROKEN |

DELIVER replaces the bodies and removes the `__SCAFFOLD__` marker (`grep -r "__SCAFFOLD__" server/src/` must be empty at DELIVER end).

## Wave: DISTILL / [REF] Test Placement

`server/__tests__/` — the established home for server/CLI vitest tests
(`cli.test.ts`, `appFocus.test.ts` precedent). No new test-type directory needed.

## Wave: DISTILL / [REF] Driving Adapter Coverage

The one CLI driving adapter (`npx pixel-agents`) is exercised via **subprocess**
against the real `dist/cli.js` (`cliLaunch.test.ts`), verifying stdout output,
`/api/health` liveness, and (for reuse) exit code — not just calling the decision
functions. Zero uncovered entry points (no HTTP/hook entry points added).

## Wave: DISTILL / [REF] Outcomes Registered

`OUT-1` (operation) written to `docs/product/outcomes/registry.yaml` — one-click
launch of the browser viewer. (The `nwave-ai outcomes register` CLI has a
packaging bug — missing bundled `schema.json` — so the row was authored directly
in canonical shape; `check-delta` read path is unaffected.)

## Wave: DISTILL / [REF] Pre-requisites (for DELIVER)

- DESIGN driving/driven ports (above) + ADR-0001..0003.
- Reuse targets: `appFocus.openUri`, `server.start()` reuse (`server.ts:82-91`),
  `ServerConfig.pid`, `parseArgs` (`cli.ts:42`).
- DELIVER must add a **headless opener seam** (e.g. env override) so the default-
  open walking-skeleton scenario can assert "Opened <url>" without launching a
  real browser (open question OQ2).

---

## Wave: DELIVER / [REF] What shipped, and where it departs from DESIGN

All 14 scenarios are green (`launchViewer.test.ts`, `cliLaunch.test.ts`); the
`__SCAFFOLD__` marker is gone. Four departures, each forced by code that changed
after DESIGN was written:

- **D4 / DD6: hooks are consent-gated now.** A fresh install waits for approval
  in the browser, so the live-activity line has a third state ("file-watch mode
  — approve hooks in the browser") beside ON and file-watch.
- **`--no-hooks` is a per-run override, not persisted.** Persisting
  `hooksEnabled=false` without an uninstall leaves live entries that the next
  start would skip (see CLAUDE.md, "Hooks-off is persisted only AFTER a
  successful uninstall").
- **The opened URL carries `?token=`.** Without the token the session can't
  approve the hook install (`standaloneTokenValid`). `resolveViewerUrl(port)`
  with no token still returns the bare loopback URL.
- **AC3.3 needed a `start()` change.** ADR-0002 assumed `start()` honors an
  explicit port; it reused any live standalone server. An explicit `port` now
  reuses only a server already on that port.

Seam (OQ2): `PIXEL_AGENTS_OPEN_CMD` replaces the OS opener. `appFocus`'s default
spawn now swallows the async `error` event, so a missing opener (no `xdg-open`)
can't crash the host. OQ3 stays "explicit flag only"; the existing CLI tests and
the e2e standalone helper pass `--no-open`.
