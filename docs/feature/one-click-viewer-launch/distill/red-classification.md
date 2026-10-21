# RED classification — one-click-viewer-launch (DISTILL pre-DELIVER gate)

Ran `npx vitest run launchViewer` against the RED scaffold (`server/src/launchViewer.ts`).
All 10 unit-layer acceptance tests fail by **throwing `Error: Not yet implemented
-- RED scaffold`** from the scaffold function bodies — imports resolved, each
assertion reached the function call.

| Scenario (test)                           | AC          | Classification           |
| ----------------------------------------- | ----------- | ------------------------ |
| parseLaunchFlags defaults open/hooks true | AC1.1       | ✅ MISSING_FUNCTIONALITY |
| parseLaunchFlags `--no-open`              | AC2.1       | ✅ MISSING_FUNCTIONALITY |
| parseLaunchFlags `--no-hooks`             | AC4.3       | ✅ MISSING_FUNCTIONALITY |
| parseLaunchFlags both flags               | DD5         | ✅ MISSING_FUNCTIONALITY |
| resolveViewerUrl loopback                 | AC1.3/DD4   | ✅ MISSING_FUNCTIONALITY |
| planLaunch fresh start opens+holds        | AC1.1/AC1.2 | ✅ MISSING_FUNCTIONALITY |
| planLaunch reused prints+exits            | AC3.1       | ✅ MISSING_FUNCTIONALITY |
| planLaunch `--no-open` prints URL         | AC2.1       | ✅ MISSING_FUNCTIONALITY |
| describeLiveActivity ON                   | AC4.1       | ✅ MISSING_FUNCTIONALITY |
| describeLiveActivity file-watch           | AC4.2       | ✅ MISSING_FUNCTIONALITY |

**Verdict**: 10/10 correct RED (category 1). Zero IMPORT_ERROR / FIXTURE_BROKEN /
SETUP_FAILURE (category 2). Zero WRONG_ASSERTION / OBSERVABLE_NOT_AT_PORT
(category 3). Handoff to DELIVER is UNBLOCKED.

After classification the ATs were marked `it.skip` (scaffolded RED per ADR-025);
DELIVER un-skips one at a time during the RED→GREEN cycle. The subprocess
walking-skeleton / driving-adapter scenarios (`cliLaunch.test.ts`) are likewise
`it.skip` (they require the built `dist/cli.js` + the implemented feature).

## Post-review additions (Final Wave Review Gate — Sentinel)

Sentinel (structural reviewer) flagged three AC-coverage gaps; scenarios added to
`cliLaunch.test.ts` (all `it.skip`, pending DELIVER):

- **AC3.3** (was blocker) — explicit `--port` override starts a NEW server (no reuse).
- **AC2.2** (was high) — an injected browser-open _failure_ prints the URL and keeps serving (distinct from `--no-open`); DELIVER must expose an opener override (e.g. `PIXEL_AGENTS_OPEN_CMD`).
- **AC2.3** (was high) — `--help` documents `--no-open` / `--no-hooks`, exits 0.

Every AC (AC1.1–AC4.3) now maps to ≥1 scenario. These new scenarios are subprocess
ATs (not part of the unit RED gate above); they enter RED naturally in DELIVER once
`dist/cli.js` is rebuilt with the (still-unimplemented) feature.
