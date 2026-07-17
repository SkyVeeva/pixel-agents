import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  getCoworkAuxProjectRoots,
  getCoworkSessionsRoot,
  isCoworkPath,
  listCoworkSessionDirs,
} from '../src/providers/hook/claude/claudeSurfacePaths.js';

/** Create a Cowork session dir (optionally with a private .claude/projects). */
function makeCoworkSession(
  root: string,
  account: string,
  user: string,
  sessionName: string,
  opts: { withProjects?: boolean } = {},
): string {
  const sessionDir = path.join(root, account, user, sessionName);
  fs.mkdirSync(sessionDir, { recursive: true });
  if (opts.withProjects) {
    fs.mkdirSync(path.join(sessionDir, '.claude', 'projects', 'some-hash'), { recursive: true });
  }
  return sessionDir;
}

describe('claudeSurfacePaths', () => {
  let tempHome: string;
  let coworkRoot: string;
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'pxl-surface-test-'));
    // Isolate the app-support location on every OS by env: HOME (darwin/linux
    // homedir), USERPROFILE (win32 homedir), APPDATA (win32), XDG_CONFIG_HOME
    // (linux). os.homedir() is non-configurable, so we drive it via env only.
    for (const k of ['HOME', 'USERPROFILE', 'APPDATA', 'XDG_CONFIG_HOME']) {
      saved[k] = process.env[k];
    }
    process.env.HOME = tempHome;
    process.env.USERPROFILE = tempHome;
    process.env.APPDATA = path.join(tempHome, 'AppData', 'Roaming');
    process.env.XDG_CONFIG_HOME = path.join(tempHome, '.config');
    const root = getCoworkSessionsRoot();
    if (!root) throw new Error('unsupported platform for this test');
    coworkRoot = root;
  });

  afterEach(() => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    fs.rmSync(tempHome, { recursive: true, force: true });
  });

  it('returns [] for every accessor when the app-support tree is absent', () => {
    expect(listCoworkSessionDirs()).toEqual([]);
    expect(getCoworkAuxProjectRoots()).toEqual([]);
  });

  it('lists Cowork session dirs across UUID and non-UUID account levels', () => {
    // A normal UUID-shaped account, plus the observed literal `skills-plugin`
    // account dir that a UUID gate would wrongly drop.
    const s1 = makeCoworkSession(coworkRoot, 'acct-uuid', 'user-uuid', 'local_aaa', {
      withProjects: true,
    });
    const s2 = makeCoworkSession(coworkRoot, 'skills-plugin', 'user-uuid', 'local_bbb', {
      withProjects: true,
    });
    // A non-session dir and a non-prefixed entry must be ignored.
    fs.mkdirSync(path.join(coworkRoot, 'acct-uuid', 'user-uuid', 'not-a-session'), {
      recursive: true,
    });

    const dirs = listCoworkSessionDirs().sort();
    expect(dirs).toEqual([s1, s2].sort());
  });

  it('returns aux project roots only for sessions with an existing .claude/projects', () => {
    makeCoworkSession(coworkRoot, 'acct', 'user', 'local_has', { withProjects: true });
    makeCoworkSession(coworkRoot, 'acct', 'user', 'local_missing', { withProjects: false });

    const roots = getCoworkAuxProjectRoots();
    expect(roots).toHaveLength(1);
    expect(roots[0]).toBe(
      path.join(coworkRoot, 'acct', 'user', 'local_has', '.claude', 'projects'),
    );
  });

  it('isCoworkPath is true under the Cowork root and false elsewhere', () => {
    const inside = path.join(coworkRoot, 'acct', 'user', 'local_x', '.claude', 'projects');
    expect(isCoworkPath(inside)).toBe(true);
    expect(isCoworkPath(path.join(tempHome, '.claude', 'projects'))).toBe(false);
    expect(isCoworkPath('')).toBe(false);
  });
});
