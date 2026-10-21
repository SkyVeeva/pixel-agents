# ADR-0003 — Graceful degradation: always print the viewer URL; open is best-effort

- **Status**: Accepted (2026-07-17)
- **Feature**: one-click-viewer-launch
- **Wave**: DESIGN

## Context

Auto-open can silently no-op on headless / SSH / CI boxes, and `openUri` is
fire-and-forget so we cannot detect that. The DISCUSS mandate (D5) is: **never
hard-fail the launch**.

## Decision

1. **Always** print the viewer URL prominently (loopback `http://127.0.0.1:<port>`),
   whether or not auto-open runs — under an "Open this in your browser:" heading
   when `--no-open` is set or when running without a detectable display.
2. Auto-open is **best-effort and additive**: attempt `openUri` unless `--no-open`;
   never gate success on it.
3. Coerce the opened URL to **loopback** (`127.0.0.1`) even when `--host 0.0.0.0`
   is bound, since a wildcard host is not directly openable.
4. Provide a `main()` opener seam (injectable) so unit tests can assert open was
   invoked with the right URL; e2e asserts on the **stdout "Opened <url>" line**
   as the observable proxy (a real browser launch is not assertable).

## Consequences

- US-2 (headless/opt-out) is satisfied without failure-detection code.
- Exit code stays 0 on the `--no-open` / headless happy path.
- Observability for tests is the printed line, aligning with the repo's
  "assert on visible outcomes" e2e discipline.

## Alternatives considered

- Detect display availability (`$DISPLAY`, TTY heuristics) before opening —
  rejected as brittle and unnecessary given best-effort open + always-print.
