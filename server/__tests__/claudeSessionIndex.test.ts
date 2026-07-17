import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { claudeSessionIndex } from '../src/providers/hook/claude/claudeSessionIndex.js';
import {
  getCoworkSessionsRoot,
  getDesktopSessionMetadataRoot,
} from '../src/providers/hook/claude/claudeSurfacePaths.js';

function writeJson(filePath: string, obj: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(obj), 'utf8');
}

/** Write a desktop sidecar under claude-code-sessions/<acct>/<user>/local_<id>.json. */
function writeDesktopSidecar(root: string, id: string, obj: Record<string, unknown>): void {
  writeJson(path.join(root, 'acct', 'user', `local_${id}.json`), obj);
}

/** Write a Cowork session: the local_<id>/ dir (with .claude/projects) AND its
 *  sibling local_<id>.json metadata sidecar. */
function writeCoworkSidecar(root: string, id: string, obj: Record<string, unknown>): void {
  const sessionDir = path.join(root, 'acct', 'user', `local_${id}`);
  fs.mkdirSync(path.join(sessionDir, '.claude', 'projects'), { recursive: true });
  writeJson(`${sessionDir}.json`, obj);
}

describe('claudeSessionIndex.listSessions', () => {
  let tempHome: string;
  const saved: Record<string, string | undefined> = {};
  let desktopRoot: string;
  let coworkRoot: string;

  beforeEach(() => {
    tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'pxl-sessidx-test-'));
    for (const k of ['HOME', 'USERPROFILE', 'APPDATA', 'XDG_CONFIG_HOME'])
      saved[k] = process.env[k];
    process.env.HOME = tempHome;
    process.env.USERPROFILE = tempHome;
    process.env.APPDATA = path.join(tempHome, 'AppData', 'Roaming');
    process.env.XDG_CONFIG_HOME = path.join(tempHome, '.config');
    desktopRoot = getDesktopSessionMetadataRoot()!;
    coworkRoot = getCoworkSessionsRoot()!;
  });

  afterEach(() => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    fs.rmSync(tempHome, { recursive: true, force: true });
  });

  it('returns [] when no metadata trees exist', () => {
    expect(claudeSessionIndex.listSessions()).toEqual([]);
  });

  it('reads desktop sidecars with surface=desktop and the title/archived/externalRef', () => {
    writeDesktopSidecar(desktopRoot, 'd1', {
      cliSessionId: 'cli-d1',
      sessionId: 'local_d1',
      title: 'Desktop work',
      isArchived: false,
    });

    const entries = claudeSessionIndex.listSessions();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      sessionId: 'cli-d1',
      info: {
        surface: 'desktop',
        title: 'Desktop work',
        isArchived: false,
        externalRef: 'local_d1',
      },
    });
  });

  it('reads Cowork sidecars with surface=cowork and a transcriptDirPrefix', () => {
    writeCoworkSidecar(coworkRoot, 'c1', {
      cliSessionId: 'cli-c1',
      sessionId: 'local_c1',
      title: 'Cowork deck',
      isArchived: true,
    });

    const entries = claudeSessionIndex.listSessions();
    expect(entries).toHaveLength(1);
    const entry = entries[0];
    expect(entry.sessionId).toBe('cli-c1');
    expect(entry.info.surface).toBe('cowork');
    expect(entry.info.title).toBe('Cowork deck');
    expect(entry.info.isArchived).toBe(true);
    expect(entry.info.transcriptDirPrefix).toBe(
      path.join(coworkRoot, 'acct', 'user', 'local_c1', '.claude', 'projects'),
    );
  });

  it('skips malformed JSON and sidecars missing cliSessionId, without throwing', () => {
    // Malformed JSON.
    const bad = path.join(desktopRoot, 'acct', 'user', 'local_bad.json');
    fs.mkdirSync(path.dirname(bad), { recursive: true });
    fs.writeFileSync(bad, '{ not json', 'utf8');
    // Valid JSON but no cliSessionId.
    writeDesktopSidecar(desktopRoot, 'nocli', { title: 'orphan', isArchived: false });
    // One good entry alongside the bad ones.
    writeDesktopSidecar(desktopRoot, 'good', { cliSessionId: 'cli-good', isArchived: false });

    const entries = claudeSessionIndex.listSessions();
    expect(entries.map((e) => e.sessionId)).toEqual(['cli-good']);
    expect(entries[0].info.title).toBeUndefined();
  });

  it('defaults isArchived to false when the field is absent or non-boolean', () => {
    writeDesktopSidecar(desktopRoot, 'x', { cliSessionId: 'cli-x', isArchived: 'yes' });
    const entries = claudeSessionIndex.listSessions();
    expect(entries[0].info.isArchived).toBe(false);
  });
});
