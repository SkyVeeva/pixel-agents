import { expect, test } from '../../fixtures/standalone';
import { updateCoworkMetadata, writeCoworkSession } from '../../helpers/cowork';
import { expectOverlayCount, expectOverlayVisible } from '../../helpers/office';
import type { RecordedServerMessage } from '../../helpers/standalone';
import { setSettings } from '../../helpers/webview';

test.describe('Standalone / cowork', () => {
  test('adopts a Cowork session when the toggle is on and despawns when off @area:standalone', async ({
    page,
    standalone,
  }) => {
    // Labels always on so the activity overlay renders without hover/selection.
    await setSettings(page, { alwaysShowLabels: true });
    await standalone.drainMessages();

    // Simulate Claude.app writing a live Cowork session (in-progress Read).
    // Cowork fires no hooks and has no CLI process, so writing the tree is the
    // only faithful stimulus — assertions below run purely on the visible UI.
    const cliSessionId = 'cowork-e2e-11111111-2222-3333-4444-555555555555';
    writeCoworkSession(standalone.tmpHome, { cliSessionId });

    // Discovery is gated: with the toggle OFF, nothing is adopted.
    await page.waitForTimeout(1_000);
    await expectOverlayCount(page, 0);

    // Turn Cowork discovery on -> the external scanner adopts it on its next tick.
    await setSettings(page, { watchCoworkSessions: true });

    await expectOverlayCount(page, 1);
    await expectOverlayVisible(page, 'Reading demo.ts');

    // The adopted character is tagged surface=cowork (drives the "Cowork · …"
    // label prefix; data-surface is set on the overlay root itself).
    await expect(page.locator('[data-testid="agent-overlay"][data-surface="cowork"]')).toHaveCount(
      1,
    );

    const created = (await standalone.drainMessages()).find(
      (m): m is RecordedServerMessage & { surface?: string } =>
        m.type === 'agentCreated' && m.surface === 'cowork',
    );
    expect(created).toBeTruthy();

    // Turning the toggle OFF despawns the Cowork character immediately
    // (removeAgentsBySurface), not on a stale-check delay.
    await setSettings(page, { watchCoworkSessions: false });
    await expectOverlayCount(page, 0);
  });

  test('shows the session title from metadata and despawns when the session is archived @area:standalone', async ({
    page,
    standalone,
  }) => {
    await setSettings(page, { alwaysShowLabels: true, watchCoworkSessions: true });
    await standalone.drainMessages();

    const cliSessionId = 'cowork-title-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    const handle = writeCoworkSession(standalone.tmpHome, {
      cliSessionId,
      title: 'Precision deck',
    });

    // The session-index poller joins the sidecar to the adopted agent and
    // surfaces its human title, prefixed with the surface ("Cowork · <title>").
    await expectOverlayCount(page, 1);
    await expectOverlayVisible(page, 'Cowork · Precision deck');

    // Archiving the session in Claude.app (flip the sidecar) drives poller
    // removal — the character despawns without any toggle change.
    updateCoworkMetadata(handle, { isArchived: true });
    await expectOverlayCount(page, 0);
  });
});
