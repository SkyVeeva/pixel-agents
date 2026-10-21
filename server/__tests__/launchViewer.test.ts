/**
 * Acceptance tests (unit layer) for one-click-viewer-launch.
 *
 * Driving port: the `pixel-agents` CLI. These cover the pure decision logic;
 * the end-to-end subprocess path is covered by
 * server/__tests__/cliLaunch.test.ts (@walking_skeleton @driving_adapter).
 *
 * Traceability: US-1 (auto-open), US-2 (headless/opt-out), US-3 (reuse),
 * US-4 (live-activity status). See feature-delta.md ACs.
 */
import { describe, expect, it } from 'vitest';

import {
  describeLiveActivity,
  parseLaunchFlags,
  planLaunch,
  resolveViewerUrl,
} from '../src/launchViewer.js';

// @US-1 @US-2 @driving_port — flag parsing for the single smart command
describe('parseLaunchFlags', () => {
  it('defaults open=true and hooks=true with no flags (AC1.1)', () => {
    expect(parseLaunchFlags([])).toEqual({ open: true, hooks: true });
  });

  it('--no-open flips open to false, hooks stays true (AC2.1)', () => {
    expect(parseLaunchFlags(['--no-open'])).toEqual({ open: false, hooks: true });
  });

  it('--no-hooks flips hooks to false, open stays true (AC4.3)', () => {
    expect(parseLaunchFlags(['--no-hooks'])).toEqual({ open: true, hooks: false });
  });

  it('both flags together flip both off', () => {
    expect(parseLaunchFlags(['--no-open', '--no-hooks'])).toEqual({ open: false, hooks: false });
  });
});

// @US-1 @error — loopback coercion (AC1.3 / DD4)
describe('resolveViewerUrl', () => {
  it('builds a loopback URL from the port', () => {
    expect(resolveViewerUrl(3100)).toBe('http://127.0.0.1:3100');
  });

  it('carries the server token so the session can approve hooks', () => {
    expect(resolveViewerUrl(3100, 'abc')).toBe('http://127.0.0.1:3100/?token=abc');
  });
});

// @US-1 @US-3 @driving_port — the post-start decision
describe('planLaunch', () => {
  it('fresh start: opens the browser and holds the process (AC1.1, AC1.2)', () => {
    const plan = planLaunch({ port: 3100, configPid: 4242, selfPid: 4242, open: true });
    expect(plan.reused).toBe(false);
    expect(plan.shouldOpen).toBe(true);
    expect(plan.exitAfter).toBe(false);
    expect(plan.url).toBe('http://127.0.0.1:3100');
    expect(plan.lines.some((l) => l.includes('Opened http://127.0.0.1:3100'))).toBe(true);
  });

  it('reused instance: prints "Reusing running instance", opens, then exits (AC3.1)', () => {
    // configPid differs from selfPid -> start() returned an existing server.
    const plan = planLaunch({ port: 3100, configPid: 999, selfPid: 4242, open: true });
    expect(plan.reused).toBe(true);
    expect(plan.exitAfter).toBe(true);
    expect(plan.shouldOpen).toBe(true);
    expect(plan.lines.some((l) => l.includes('Reusing running instance'))).toBe(true);
  });

  it('--no-open: does not open, prints a copy-friendly URL, still serves (AC2.1)', () => {
    const plan = planLaunch({ port: 3100, configPid: 4242, selfPid: 4242, open: false });
    expect(plan.shouldOpen).toBe(false);
    expect(plan.exitAfter).toBe(false);
    expect(plan.lines.some((l) => l.includes('Open this in your browser:'))).toBe(true);
    expect(plan.lines.some((l) => l.includes('http://127.0.0.1:3100'))).toBe(true);
  });
});

// @US-4 — legible live-activity status line
describe('describeLiveActivity', () => {
  it('reports ON when hooks installed (AC4.1)', () => {
    expect(describeLiveActivity({ requested: true, installed: true })).toContain(
      'Live Claude activity: ON',
    );
  });

  it('reports file-watch fallback when hooks are off or failed (AC4.2)', () => {
    expect(describeLiveActivity({ requested: true, installed: false })).toContain('file-watch');
    expect(describeLiveActivity({ requested: false, installed: false })).toContain('file-watch');
  });

  it('points at the browser approval when consent is still pending', () => {
    const line = describeLiveActivity({ requested: true, installed: false, awaitingConsent: true });
    expect(line).toContain('file-watch');
    expect(line).toContain('approve hooks in the browser');
  });
});
