/**
 * Claude.app session index: reads the two metadata sidecar families the desktop
 * app writes and normalizes them into SessionIndexEntry rows keyed by
 * `cliSessionId` (the transcript basename — the join key for every adoption
 * path). Undocumented internals; parsed DEFENSIVELY — a malformed or partially
 * written sidecar is skipped, never fatal, so a bad file can't blank the index.
 *
 *   - Desktop ("Code" tab): claude-code-sessions/<acct>/<user>/local_<uuid>.json
 *   - Cowork ("Cowork" tab): local-agent-mode-sessions/.../local_<uuid>.json
 *     (sibling to the private-home session dir)
 */
import * as fs from 'fs';

import type {
  SessionIndexEntry,
  SessionIndexProvider,
} from '../../../../../core/src/sessionIndexProvider.js';
import {
  getCoworkSessionMetadataFile,
  listCoworkSessionDirs,
  listDesktopSessionMetadataFiles,
} from './claudeSurfacePaths.js';

/** Origin-surface labels for the two Claude.app metadata families. */
const SURFACE_DESKTOP = 'desktop';
const SURFACE_COWORK = 'cowork';

/** Parse one sidecar file into an entry. Returns null on any problem so a single
 *  bad/half-written file never poisons the whole snapshot. */
function parseSidecar(
  filePath: string,
  surface: string,
  transcriptDirPrefix?: string,
): SessionIndexEntry | null {
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
  let obj: unknown;
  try {
    obj = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!obj || typeof obj !== 'object') return null;
  const rec = obj as Record<string, unknown>;

  // cliSessionId is the join key; without it the row is unusable.
  const cliSessionId = rec.cliSessionId;
  if (typeof cliSessionId !== 'string' || cliSessionId.length === 0) return null;

  const title = typeof rec.title === 'string' && rec.title.length > 0 ? rec.title : undefined;
  const isArchived = rec.isArchived === true;
  // `sessionId` (the local_<uuid>) is the host's own handle — used later by the
  // focus layer. Fall back to undefined when absent.
  const externalRef = typeof rec.sessionId === 'string' ? rec.sessionId : undefined;

  return {
    sessionId: cliSessionId,
    info: { surface, title, isArchived, externalRef, transcriptDirPrefix },
  };
}

/**
 * Read both metadata families and return one entry per parseable session. If
 * the same cliSessionId somehow appears twice, the last writer wins (Cowork is
 * read after desktop); duplicates were never observed in practice.
 */
function listSessions(): SessionIndexEntry[] {
  const byId = new Map<string, SessionIndexEntry>();

  for (const file of listDesktopSessionMetadataFiles()) {
    const entry = parseSidecar(file, SURFACE_DESKTOP);
    if (entry) byId.set(entry.sessionId, entry);
  }

  for (const sessionDir of listCoworkSessionDirs()) {
    // Cowork transcripts live in the session's private home; the path prefix
    // lets the runtime join even if the cliSessionId key ever changes shape.
    const transcriptDirPrefix = `${sessionDir}/.claude/projects`;
    const entry = parseSidecar(
      getCoworkSessionMetadataFile(sessionDir),
      SURFACE_COWORK,
      transcriptDirPrefix,
    );
    if (entry) byId.set(entry.sessionId, entry);
  }

  return [...byId.values()];
}

export const claudeSessionIndex: SessionIndexProvider = {
  listSessions,
};
