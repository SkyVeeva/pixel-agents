/**
 * Claude-specific constants. Kept separate from `server/src/constants.ts` so a
 * future single-provider `server/` build doesn't accidentally depend on Claude
 * unless Claude is the active provider.
 *
 * Adding another provider? Create its own `providers/<kind>/<name>/constants.ts`.
 */

/** Output filename after esbuild compiles claude-hook.ts to CJS (source is .ts, output is .js) */
export const CLAUDE_HOOK_SCRIPT_NAME = 'claude-hook.js';

/** Hook events to install in ~/.claude/settings.json.
 *  SessionStart/SessionEnd handle session lifecycle (start, /clear, resume, exit).
 *  Stop/PermissionRequest/Notification handle turn completion and permission UI.
 *  SubagentStart/SubagentStop/TeammateIdle/TaskCreated/TaskCompleted power Agent Teams. */
export const CLAUDE_HOOK_EVENTS = [
  'SessionStart',
  'SessionEnd',
  'Stop',
  'PermissionRequest',
  'Notification',
  'UserPromptSubmit',
  'PreToolUse',
  'PostToolUse',
  'PostToolUseFailure',
  'SubagentStart',
  'SubagentStop',
  'TeammateIdle',
  'TaskCreated',
  'TaskCompleted',
] as const;

/** Terminal name prefix used when launching Claude Code in VS Code.
 *  Used by the extension to match terminals to agents for adoption. */
export const CLAUDE_TERMINAL_NAME_PREFIX = 'Claude Code';

// ── Claude.app (desktop + Cowork) support-directory layout ──
//
// Undocumented internals of the Claude desktop app, verified 2026-07-17 against
// app claude-code 2.1.209 (see docs/superpowers/specs). All names live here so
// tmpHome-based tests and future OS ports have a single source of truth.

/** Application-support subdirectory name for the Claude desktop app. */
export const CLAUDE_APP_SUPPORT_DIR_NAME = 'Claude';

/** Holds Cowork ("local agent mode") per-session directories, each with a
 *  private `.claude` home. No settings.json inside -> hooks never fire. */
export const COWORK_SESSIONS_DIR_NAME = 'local-agent-mode-sessions';

/** Holds desktop-app (Code tab) session metadata sidecars. Transcripts for
 *  these sessions live in the normal global ~/.claude/projects. */
export const DESKTOP_SESSIONS_DIR_NAME = 'claude-code-sessions';

/** Per-session directory / sidecar filename prefix (e.g. local_<uuid>). */
export const CLAUDE_APP_SESSION_DIR_PREFIX = 'local_';

/** Deep-link prefix that fronts a Claude Code session in Claude.app. The
 *  cliSessionId is appended (URI-encoded). Verified against the app's own
 *  `claude://resume` route (Phase 0). */
export const CLAUDE_APP_RESUME_URI_PREFIX = 'claude://resume?session=';

/** Application name passed to the OS "activate this app" fallback when no
 *  per-session deep link exists (Cowork). */
export const CLAUDE_APP_NAME = 'Claude';
