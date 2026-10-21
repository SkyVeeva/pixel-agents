# ADR-0001 — Reuse `appFocus.openUri` for browser launch

- **Status**: Accepted (2026-07-17)
- **Feature**: one-click-viewer-launch
- **Wave**: DESIGN

## Context

The one-click launch must open the default browser to the running viewer. The
codebase already has `server/src/appFocus.ts` `openUri(uri, {platform, spawn})`:
per-OS command resolution (`open` / `xdg-open` / `cmd /c start`), a `spawn`
injection seam for tests, and best-effort semantics (swallows errors, never
throws). It was built for `claude://` deep links but is provider-agnostic.

## Decision

Reuse `openUri` for the browser launch. Do **not** introduce a new opener
utility or a third-party "open" dependency.

## Consequences

- One call site in `cli.ts main()`; per-OS logic and its unit-test seam are
  already covered.
- Because `openUri` never throws, "browser-open failure never crashes the
  launch" (US-2 / AC2.2) is satisfied **by construction** — no failure-detection
  branch is needed.
- Trade-off: `openUri` is fire-and-forget (detached spawn), so we cannot know
  whether the browser actually appeared. We compensate by **always printing the
  URL** (ADR-0003), making the outcome observable regardless.

## Alternatives considered

- New `openBrowser()` helper or an `open`/`opener` npm dependency — rejected:
  duplicates existing per-OS logic and adds a dependency for zero benefit.
