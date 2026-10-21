/**
 * One-click launch decision logic for `npx pixel-agents`.
 *
 * Pure, side-effect-free decision functions so the CLI `main()` stays a thin
 * shell that wires these to `openUri` + `console.log`.
 *
 * See docs/product/architecture/adr-0001..0003 and
 * docs/feature/one-click-viewer-launch/feature-delta.md (DESIGN sections).
 */

/** Flags controlling the one-click launch, parsed from argv. Positive booleans
 *  (`open`/`hooks`) default true; `--no-open` / `--no-hooks` flip them off. */
export interface LaunchFlags {
  /** false when `--no-open` is passed. */
  open: boolean;
  /** false when `--no-hooks` is passed: skip hook install for this run only
   *  (never persisted — a persisted hooks-off without an uninstall strands the
   *  user with live entries the next start would skip). */
  hooks: boolean;
}

/** The plan the CLI executes after `server.start()` resolves. */
export interface LaunchPlan {
  /** True when `start()` returned an existing instance (config.pid !== our pid). */
  reused: boolean;
  /** Loopback viewer URL to open / print. */
  url: string;
  /** Whether to attempt a browser open (false under `--no-open`). */
  shouldOpen: boolean;
  /** True when we reused someone else's server → open + exit 0, don't hold open. */
  exitAfter: boolean;
  /** stdout lines the CLI should print, in order. */
  lines: string[];
}

/** Hook-install outcome the live-activity line reports on. */
export interface LiveActivityInput {
  /** Hooks wanted this run (persisted preference on, and no `--no-hooks`). */
  requested: boolean;
  /** The install succeeded (or our hooks were already in place). */
  installed: boolean;
  /** Install skipped because the one-time consent hasn't been given yet. */
  awaitingConsent?: boolean;
}

/** Parse the one-click flags out of argv. `--no-open` and `--no-hooks` flip the
 *  positive defaults; everything else is ignored here (handled by parseArgs). */
export function parseLaunchFlags(argv: string[]): LaunchFlags {
  return {
    open: !argv.includes('--no-open'),
    hooks: !argv.includes('--no-hooks'),
  };
}

/** Build the loopback viewer URL. Always `127.0.0.1` regardless of bind host
 *  (a wildcard host like 0.0.0.0 is not directly openable) — ADR-0003 DD4.
 *  The token, when given, is what makes the loaded session privileged enough
 *  to approve a hook install (standaloneTokenValid in httpServer.ts). */
export function resolveViewerUrl(port: number, token?: string): string {
  const base = `http://127.0.0.1:${port}`;
  return token ? `${base}/?token=${encodeURIComponent(token)}` : base;
}

/** One-line live-activity status derived from the hook-install outcome. */
export function describeLiveActivity(hooks: LiveActivityInput): string {
  if (hooks.requested && hooks.installed) return 'Live Claude activity: ON (hooks installed)';
  if (hooks.requested && hooks.awaitingConsent) {
    return 'Live Claude activity: file-watch mode — approve hooks in the browser for instant updates';
  }
  if (hooks.requested) {
    return 'Live Claude activity: file-watch mode — hook install failed (see error above); toggle "Instant Detection (Hooks)" in Settings to retry';
  }
  return 'Live Claude activity: file-watch mode (hooks off) — enable "Instant Detection (Hooks)" in Settings for instant updates';
}

/** Decide what the CLI does after start(): reuse-and-exit vs fresh, open vs
 *  print-only, and the exact stdout lines. Pure — no I/O. */
export function planLaunch(input: {
  port: number;
  /** pid from the ServerConfig start() returned. */
  configPid: number;
  /** this process's pid. */
  selfPid: number;
  /** LaunchFlags.open. */
  open: boolean;
  /** Server token, appended to the URL so the session can approve hooks. */
  token?: string;
}): LaunchPlan {
  const reused = input.configPid !== input.selfPid;
  const url = resolveViewerUrl(input.port, input.token);
  const lines: string[] = [];
  if (reused) lines.push(`Reusing running instance (PID ${input.configPid})`);
  if (input.open) {
    lines.push(`Opened ${url}`);
  } else {
    lines.push('Open this in your browser:', `  ${url}`);
  }
  return { reused, url, shouldOpen: input.open, exitAfter: reused, lines };
}
