/**
 * Optional provider extension for CLIs whose sessions carry out-of-band
 * metadata (a human title, an origin surface, an archived flag) that lives
 * beside the transcript rather than inside it. Mirrors the `team?: TeamProvider`
 * precedent: providers that have such a sidecar implement this and expose it as
 * `HookProvider.sessionIndex`; the runtime polls it, joins by session id, and
 * enriches / lifecycles the matching agents.
 *
 * Claude.app (desktop "Code" tab + "Cowork" tab) is the only implementation
 * today — see server/src/providers/hook/claude/claudeSessionIndex.ts.
 */

/** Metadata for one session, read from a provider-specific sidecar. */
export interface SessionInfo {
  /** Origin surface, e.g. 'cowork' or 'desktop'. Free string (no enum). */
  surface: string;
  /** Human-readable session title, when the sidecar records one. */
  title?: string;
  /** True when the user has archived/closed the session — the runtime removes
   *  its agent and refuses to (re-)adopt it. */
  isArchived: boolean;
  /** Opaque host reference for focusing this session (e.g. the app's own
   *  `local_<uuid>` id). Consumed by the focus layer (buildFocusUri). */
  externalRef?: string;
  /** Absolute path prefix of this session's transcript directory. Enables a
   *  path-based join fallback for surfaces (Cowork) whose transcripts live in a
   *  private home rather than the global session root. */
  transcriptDirPrefix?: string;
}

/** One entry in the session index: the join key + its metadata. */
export interface SessionIndexEntry {
  /** Session id used to join against a running agent. For Claude this is the
   *  `cliSessionId` — equal to the transcript basename for every surface. */
  sessionId: string;
  info: SessionInfo;
}

export interface SessionIndexProvider {
  /**
   * Snapshot of every known session's metadata, read fresh each call and parsed
   * defensively (a missing tree, a malformed sidecar, or a partial write must
   * degrade to fewer entries, never throw). Order is not significant.
   */
  listSessions(): SessionIndexEntry[];
}
