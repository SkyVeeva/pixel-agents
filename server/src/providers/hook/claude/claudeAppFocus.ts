/**
 * Builds the `claude://` deep link that fronts a Claude.app session, per the
 * Phase 0 live probe (see docs/superpowers/specs/2026-07-17...):
 *
 *   - Desktop / plain CLI sessions: `claude://resume?session=<cliSessionId>`
 *     works — Claude.app's importCliSession finds the transcript in the global
 *     ~/.claude/projects and fronts + warms the session.
 *   - Cowork sessions: resume FAILS (transcript_missing — the transcript lives
 *     in a private per-session home), and there is NO per-session Cowork deep
 *     link. So we return null; the caller falls back to just activating the app.
 */
import { CLAUDE_APP_RESUME_URI_PREFIX } from './constants.js';

export interface FocusContext {
  /** The cliSessionId (transcript basename) — the value Claude.app validates. */
  sessionId: string;
  /** Origin surface; 'cowork' has no focusable deep link. */
  surface?: string;
}

/**
 * The deep link to focus this session, or null when no per-session link exists
 * (Cowork) so the caller can fall back to fronting the app.
 */
export function buildClaudeFocusUri(ctx: FocusContext): string | null {
  if (ctx.surface === 'cowork') return null;
  if (!ctx.sessionId) return null;
  return `${CLAUDE_APP_RESUME_URI_PREFIX}${encodeURIComponent(ctx.sessionId)}`;
}
