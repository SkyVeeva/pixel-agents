import fs from 'node:fs';
import path from 'node:path';

/**
 * Fabricate a Claude **Cowork** session on disk for standalone e2e.
 *
 * Cowork sessions never fire hooks and have no CLI process — the desktop app
 * just writes a private `.claude` home and pixel-agents discovers it by
 * watching the filesystem. So, unlike terminal-driven tests (which drive a
 * mocked `claude` via the scenario builder) and the hook-endpoint standalone
 * exception, the ONLY faithful way to exercise Cowork discovery is to write the
 * tree the app would have written. That is what these helpers do — they
 * simulate Claude.app's output, then assertions run purely on Playwright-visible
 * UI, never on internals.
 *
 * Paths mirror claudeSurfacePaths.getClaudeAppSupportDir() per OS. The standalone
 * fixture pins HOME/USERPROFILE/APPDATA/XDG_CONFIG_HOME under the isolated
 * tmpHome, so these locations only ever hold fabricated sessions.
 */

/** OS-specific Claude.app application-support dir under an isolated home. */
function claudeAppSupportDir(tmpHome: string): string {
  switch (process.platform) {
    case 'darwin':
      return path.join(tmpHome, 'Library', 'Application Support', 'Claude');
    case 'win32':
      return path.join(tmpHome, 'AppData', 'Roaming', 'Claude');
    default:
      return path.join(tmpHome, '.config', 'Claude');
  }
}

export interface CoworkSessionHandle {
  /** The per-session dir (`.../local-agent-mode-sessions/<acct>/<user>/local_<uuid>`). */
  sessionDir: string;
  /** The transcript file the watcher adopts. */
  transcriptPath: string;
  /** The cliSessionId (transcript basename), i.e. the join key to metadata. */
  cliSessionId: string;
}

/** A transcript with an assistant Read tool_use, padded past the scanner's
 *  3 KB activity floor so the fabricated session is treated as live. */
function buildTranscript(cliSessionId: string, readFileName: string): string {
  const lines: string[] = [];
  // Padding: a chunky prior turn so the file clears GLOBAL_SCAN_ACTIVE_MIN_SIZE.
  lines.push(
    JSON.stringify({
      type: 'user',
      sessionId: cliSessionId,
      message: { role: 'user', content: 'Summarize the repository. '.repeat(120) },
    }),
  );
  lines.push(
    JSON.stringify({
      type: 'assistant',
      sessionId: cliSessionId,
      message: {
        role: 'assistant',
        content: [{ type: 'text', text: 'Working on it. '.repeat(120) }],
      },
    }),
  );
  // The record that drives the visible overlay: a Read tool_use.
  lines.push(
    JSON.stringify({
      type: 'assistant',
      sessionId: cliSessionId,
      message: {
        role: 'assistant',
        content: [
          {
            type: 'tool_use',
            id: `toolu_${cliSessionId}`,
            name: 'Read',
            input: { file_path: readFileName },
          },
        ],
      },
    }),
  );
  return lines.join('\n') + '\n';
}

/**
 * Write a fabricated live Cowork session and return its handle. The transcript
 * contains an in-progress Read tool_use so an activity overlay ("Reading …")
 * appears once the session is adopted.
 */
export function writeCoworkSession(
  tmpHome: string,
  opts: {
    account?: string;
    user?: string;
    cliSessionId: string;
    projectHash?: string;
    readFileName?: string;
  },
): CoworkSessionHandle {
  const account = opts.account ?? 'acct-e2e';
  const user = opts.user ?? 'user-e2e';
  const projectHash = opts.projectHash ?? '-cowork-e2e-outputs';
  const readFileName = opts.readFileName ?? 'demo.ts';

  const sessionDir = path.join(
    claudeAppSupportDir(tmpHome),
    'local-agent-mode-sessions',
    account,
    user,
    `local_${opts.cliSessionId}`,
  );
  const projectsDir = path.join(sessionDir, '.claude', 'projects', projectHash);
  fs.mkdirSync(projectsDir, { recursive: true });

  const transcriptPath = path.join(projectsDir, `${opts.cliSessionId}.jsonl`);
  fs.writeFileSync(transcriptPath, buildTranscript(opts.cliSessionId, readFileName), 'utf8');

  return { sessionDir, transcriptPath, cliSessionId: opts.cliSessionId };
}

/** Remove a fabricated Cowork session dir (simulates the user archiving/closing it). */
export function deleteCoworkSession(handle: CoworkSessionHandle): void {
  fs.rmSync(handle.sessionDir, { recursive: true, force: true });
}
