# ATDD Infrastructure Policy

Per `nw-distill` § Project Infrastructure Policy. One file per project. Apply-if-exists;
write-if-absent; rewrite with `--policy=fresh`. Git history is the audit trail.
Bootstrapped by DISTILL for `one-click-viewer-launch` (2026-07-17).

Project stack: **TypeScript** — vitest (server unit), Playwright (e2e, real
standalone CLI subprocess). No pytest/cucumber/Gherkin in this repo; acceptance
tests are expressed in the project's actual frameworks per the language-adapter
mandate.

## Driving

| Port               | Mechanism                                                                                                          | Note                                         |
| ------------------ | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------- |
| `pixel-agents` CLI | Playwright `standalone` fixture spawns the real bundled `dist/cli.js`; unit layer tests pure decision fns directly | subprocess = the user's real invocation path |

## Driven internal (real)

| Port                                               | Mechanism                                                                           | Note                                       |
| -------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------ |
| server registry (`~/.pixel-agents/servers/*.json`) | real FS under an isolated `HOME`/`tmpHome` (matches existing `cli.test.ts` pattern) | PID-liveness is real `process.kill(pid,0)` |
| hook install (`~/.claude/settings.json`)           | real FS under isolated `HOME`                                                       | existing convention in `cli.test.ts`       |

## Driven external / non-deterministic (fake)

| Port                                           | Fake                                                                                                                     | Note                                               |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------- |
| OS browser open (`appFocus.openUri` → `spawn`) | injected `spawn` (`SpawnLike`) captures command+args; e2e asserts the stdout `Opened <url>` line as the observable proxy | a real browser launch is not assertable — ADR-0003 |
