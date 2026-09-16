import path from 'node:path';

import { expect, test } from '../../fixtures/standalone';
import { sendHookEvent, sessionStartStartup } from '../../helpers/hooks';
import {
  expectOverlayCount,
  expectOverlayVisible,
  readAgentOverlayIds,
} from '../../helpers/office';
import type { RecordedServerMessage } from '../../helpers/standalone';
import { setSettings } from '../../helpers/webview';

test.describe('Standalone / restore', () => {
  // Regression: existing agents must render after a fresh WebSocket connection,
  // even though the standalone server sends `layoutLoaded` BEFORE `existingAgents`.
  //
  // The webview buffers agents from `existingAgents` and flushes them into the
  // office inside the `layoutLoaded` handler. That design assumes `existingAgents`
  // arrives first — true for the VS Code postMessage path (its restore test lives
  // in claude/hooks-on/lifecycle.spec.ts and relies on `existingAgents` →
  // `layoutLoaded` → addAgent). The standalone WebSocket path replays the snapshot
  // in the opposite order (see server/src/clientMessageHandler.ts: layout at step 3,
  // existingAgents last), so a flush-on-layoutLoaded alone drops every restored
  // session — the flush has already run by the time they arrive. The
  // `existingAgents` handler is therefore order-independent: it materializes
  // immediately when the layout is already loaded, and buffers otherwise.
  test('restores existing agents after a reload despite layoutLoaded arriving first @area:standalone', async ({
    page,
    standalone,
  }) => {
    // Labels on → every character renders a countable overlay (idle ones too, so
    // a restored-but-inactive agent is still assertable). Watch-All so the
    // hook-driven session is adopted regardless of workspace.
    await setSettings(page, { alwaysShowLabels: true, watchAllSessions: true });
    await standalone.drainMessages();

    const sessionId = 'standalone-restore-test-session';
    const filePath = path.join(standalone.workspaceDir, 'demo.ts');

    // Bring one agent to life through the LIVE event path (agentCreated →
    // addAgent). This is not the path under test; it just seeds the server store
    // so the next connection has something to restore.
    await sendHookEvent(
      standalone.hookServerConfig,
      sessionStartStartup(sessionId, standalone.workspaceDir),
    );
    await sendHookEvent(standalone.hookServerConfig, {
      session_id: sessionId,
      hook_event_name: 'PreToolUse',
      tool_name: 'Read',
      tool_input: { file_path: filePath },
    });
    await expectOverlayVisible(page, 'Reading demo.ts');
    await expectOverlayCount(page, 1);
    const [liveAgentId] = await readAgentOverlayIds(page);
    expect(liveAgentId).toBeGreaterThan(0);

    // Reload → a brand-new WebSocket connection. The agent still lives in the
    // server store (no SessionEnd was sent), so the reconnect snapshot restores
    // it via `existingAgents` — the path this test guards.
    await standalone.drainMessages();
    await page.reload();
    await expect(page.getByRole('button', { name: 'Settings' })).toBeVisible({ timeout: 30_000 });

    // Regression assertion: the restored agent renders. Before the
    // order-independent fix this was 0 — the id landed in the React `agents`
    // array but no character was ever created, so ToolOverlay rendered nothing.
    await expectOverlayCount(page, 1);
    const idsAfterReload = await readAgentOverlayIds(page);
    expect(idsAfterReload).toContain(liveAgentId);

    // Pin the precondition that makes this a meaningful regression test: on the
    // standalone wire, `layoutLoaded` really does arrive before `existingAgents`,
    // and the restored snapshot carries our agent. If the server order ever flips
    // to match VS Code, this guard fires so the test is re-examined rather than
    // silently ceasing to exercise the bug.
    const reloadMessages = await standalone.drainMessages();
    const layoutIndex = reloadMessages.findIndex((message) => message.type === 'layoutLoaded');
    const existingIndex = reloadMessages.findIndex((message) => message.type === 'existingAgents');
    expect(layoutIndex).toBeGreaterThanOrEqual(0);
    expect(existingIndex).toBeGreaterThan(layoutIndex);
    const existing = reloadMessages[existingIndex] as RecordedServerMessage & {
      agents?: number[];
    };
    expect(existing.agents ?? []).toContain(liveAgentId);
  });
});
