/**
 * Filesystem layout of the Claude desktop app's support directory (desktop
 * "Code" tab + "Cowork" tab). These are UNDOCUMENTED internals of Claude.app;
 * everything here is derived from `os.homedir()` / `process.env` and parses
 * defensively, so a missing tree, an OS without the app, or a future schema
 * change degrades to an empty result rather than throwing.
 *
 * Verified 2026-07-17 against app claude-code 2.1.209 (see the Phase 0 section
 * of docs/superpowers/specs/2026-07-17-claude-ecosystem-design.md).
 *
 * Deriving from homedir/env (not hardcoded absolute paths) is load-bearing:
 * the e2e suite fabricates this whole tree under an isolated tmpHome.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import {
  CLAUDE_APP_SESSION_DIR_PREFIX,
  CLAUDE_APP_SUPPORT_DIR_NAME,
  COWORK_SESSIONS_DIR_NAME,
  DESKTOP_SESSIONS_DIR_NAME,
} from './constants.js';

/**
 * Absolute path to the Claude desktop app's application-support directory, per
 * OS. Returns null on platforms where the location is unknown. Does NOT check
 * for existence — callers that walk it tolerate a missing dir.
 */
export function getClaudeAppSupportDir(): string | null {
  const home = os.homedir();
  switch (process.platform) {
    case 'darwin':
      return path.join(home, 'Library', 'Application Support', CLAUDE_APP_SUPPORT_DIR_NAME);
    case 'win32': {
      const appData = process.env.APPDATA;
      const base = appData && appData.length > 0 ? appData : path.join(home, 'AppData', 'Roaming');
      return path.join(base, CLAUDE_APP_SUPPORT_DIR_NAME);
    }
    case 'linux': {
      const xdg = process.env.XDG_CONFIG_HOME;
      const base = xdg && xdg.length > 0 ? xdg : path.join(home, '.config');
      return path.join(base, CLAUDE_APP_SUPPORT_DIR_NAME);
    }
    default:
      return null;
  }
}

/** Root that holds Cowork per-session directories (nested under account/user). */
export function getCoworkSessionsRoot(): string | null {
  const appDir = getClaudeAppSupportDir();
  return appDir ? path.join(appDir, COWORK_SESSIONS_DIR_NAME) : null;
}

/** Root that holds desktop-app session metadata sidecars. */
export function getDesktopSessionMetadataRoot(): string | null {
  const appDir = getClaudeAppSupportDir();
  return appDir ? path.join(appDir, DESKTOP_SESSIONS_DIR_NAME) : null;
}

/** Read directory entries, returning [] on any error (missing/unreadable). */
function safeReadDirs(dir: string): string[] {
  try {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
  } catch {
    return [];
  }
}

/**
 * Every existing Cowork per-session directory (`.../local-agent-mode-sessions/
 * <account>/<user>/local_<uuid>`).
 *
 * The account/user levels are walked WITHOUT assuming a UUID shape — a literal
 * `skills-plugin` account directory was observed in the wild, so any regex gate
 * on dir names would silently drop real sessions.
 */
export function listCoworkSessionDirs(): string[] {
  const root = getCoworkSessionsRoot();
  if (!root) return [];
  const out: string[] = [];
  for (const account of safeReadDirs(root)) {
    const accountDir = path.join(root, account);
    for (const user of safeReadDirs(accountDir)) {
      const userDir = path.join(accountDir, user);
      for (const entry of safeReadDirs(userDir)) {
        if (entry.startsWith(CLAUDE_APP_SESSION_DIR_PREFIX)) {
          out.push(path.join(userDir, entry));
        }
      }
    }
  }
  return out;
}

/**
 * Auxiliary transcript roots for Cowork: the `.claude/projects` directory
 * inside each Cowork session's private home. Only roots that actually exist on
 * disk are returned, so the scanner never wastes a tick on a half-created
 * session dir. Schema-identical to ~/.claude/projects, so the normal scanner
 * and transcript parser work unchanged.
 */
export function getCoworkAuxProjectRoots(): string[] {
  const out: string[] = [];
  for (const sessionDir of listCoworkSessionDirs()) {
    const projectsRoot = path.join(sessionDir, '.claude', 'projects');
    try {
      if (fs.existsSync(projectsRoot)) out.push(projectsRoot);
    } catch {
      /* ignore */
    }
  }
  return out;
}

/** True when `p` lives under the Cowork sessions root. Used to protect Cowork
 *  agents from the "outside the workspace" external-agent cleanup. */
export function isCoworkPath(p: string): boolean {
  const root = getCoworkSessionsRoot();
  if (!root || !p) return false;
  const rel = path.relative(root, p);
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}
