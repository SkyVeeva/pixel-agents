/**
 * Walking-skeleton / driving-adapter acceptance tests for one-click-viewer-launch.
 *
 * These spawn the REAL bundled `dist/cli.js` (the user's actual invocation path)
 * and assert on stdout + /api/health — proving the entry point wires the launch
 * flow end-to-end (parse flags -> start/reuse -> print URL -> open decision).
 *
 * Tags: @walking_skeleton @driving_adapter @real-io.
 *
 * Browser-open seam: scenarios either pass `--no-open` or point
 * PIXEL_AGENTS_OPEN_CMD at a harmless command. A real browser is never launched.
 *
 * Traceability: US-1 (auto-open), US-2 (headless/opt-out), US-3 (reuse).
 */
import type { ChildProcessByStdio } from 'child_process';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as net from 'net';
import * as os from 'os';
import * as path from 'path';
import type { Readable } from 'stream';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const CLI_BUNDLE = path.join(__dirname, '../../dist/cli.js');
const START_TIMEOUT_MS = 10_000;

async function getFreePort(): Promise<number> {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('Failed to allocate a test port'));
        return;
      }
      server.close((err) => (err ? reject(err) : resolve(address.port)));
    });
  });
}

async function waitFor(check: () => boolean | Promise<boolean>): Promise<void> {
  const deadline = Date.now() + START_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error('Timed out waiting for CLI startup');
}

type Child = ChildProcessByStdio<null, Readable, Readable>;

async function stopChild(child: Child): Promise<void> {
  if (child.exitCode !== null) return;
  child.kill('SIGTERM');
  await Promise.race([
    new Promise<void>((r) => child.once('close', () => r())),
    new Promise<void>((r) => setTimeout(r, 2_000)),
  ]);
  if (child.exitCode === null) child.kill('SIGKILL');
}

describe('CLI one-click launch (walking skeleton)', () => {
  let tmpHome: string;
  let workspace: string;
  const children: Child[] = [];

  beforeEach(() => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'pxl-launch-home-'));
    workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'pxl-launch-ws-'));
  });

  afterEach(async () => {
    for (const c of children) await stopChild(c);
    children.length = 0;
    fs.rmSync(tmpHome, { recursive: true, force: true });
    fs.rmSync(workspace, { recursive: true, force: true });
  });

  function launch(args: string[], extraEnv: Record<string, string> = {}): Child {
    const child = spawn(process.execPath, [CLI_BUNDLE, ...args], {
      cwd: workspace,
      env: { ...process.env, HOME: tmpHome, USERPROFILE: tmpHome, ...extraEnv },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    children.push(child);
    return child;
  }

  // @walking_skeleton @driving_adapter @US-2 — headless path prints a copy-friendly URL (AC2.1/AC2.2)
  it('`--no-open` starts the server, prints the loopback URL, never opens a browser', async () => {
    const port = await getFreePort();
    const child = launch(['--port', String(port), '--no-open']);
    let out = '';
    child.stdout.on('data', (d: Buffer) => (out += d.toString()));
    child.stderr.on('data', (d: Buffer) => (out += d.toString()));

    await waitFor(async () => {
      if (child.exitCode !== null) throw new Error(`CLI exited early:\n${out}`);
      try {
        return (await fetch(`http://127.0.0.1:${port}/api/health`)).ok;
      } catch {
        return false;
      }
    });
    expect(out).toContain('Open this in your browser:');
    expect(out).toContain(`http://127.0.0.1:${port}`);
  });

  // @walking_skeleton @driving_adapter @US-1 — default opens the browser (AC1.1/AC1.2)
  it('default launch prints "Opened <loopback-url>" and serves', async () => {
    // A harmless opener (node fails on the URL argument, detached) so no real
    // browser launches; assert the "Opened http://127.0.0.1:<port>" line.
    const port = await getFreePort();
    const child = launch(['--port', String(port)], { PIXEL_AGENTS_OPEN_CMD: process.execPath });
    let out = '';
    child.stdout.on('data', (d: Buffer) => (out += d.toString()));
    await waitFor(async () => {
      try {
        return (await fetch(`http://127.0.0.1:${port}/api/health`)).ok;
      } catch {
        return false;
      }
    });
    expect(out).toContain(`Opened http://127.0.0.1:${port}`);
  });

  // @driving_adapter @US-3 — re-launch reuses the running instance (AC3.1)
  it('a second no-flag launch reuses the running instance instead of starting a second server', async () => {
    const first = launch(['--no-open']);
    let firstOut = '';
    first.stdout.on('data', (d: Buffer) => (firstOut += d.toString()));
    await waitFor(() => /running at http:\/\/127\.0\.0\.1:\d+/.test(firstOut));

    const second = launch(['--no-open']);
    let secondOut = '';
    second.stdout.on('data', (d: Buffer) => (secondOut += d.toString()));
    await new Promise<void>((r) => second.once('close', () => r()));

    expect(secondOut).toContain('Reusing running instance');
    // The second process must not linger as its own server — it opens + exits 0.
    expect(second.exitCode).toBe(0);
  });

  // @driving_adapter @US-3 — explicit --port overrides reuse (AC3.3)
  it('an explicit --port different from the running instance starts a NEW server (no reuse)', async () => {
    const portA = await getFreePort();
    const first = launch(['--port', String(portA), '--no-open']);
    let firstOut = '';
    first.stdout.on('data', (d: Buffer) => (firstOut += d.toString()));
    await waitFor(async () => {
      try {
        return (await fetch(`http://127.0.0.1:${portA}/api/health`)).ok;
      } catch {
        return false;
      }
    });

    const portB = await getFreePort();
    const second = launch(['--port', String(portB), '--no-open']);
    let secondOut = '';
    second.stdout.on('data', (d: Buffer) => (secondOut += d.toString()));
    await waitFor(async () => {
      try {
        return (await fetch(`http://127.0.0.1:${portB}/api/health`)).ok;
      } catch {
        return false;
      }
    });
    // Two distinct servers are live; the explicit port made the second NOT reuse.
    expect(secondOut).not.toContain('Reusing running instance');
    expect(second.exitCode).toBeNull(); // still serving, not exited-after-reuse
  });

  // @walking_skeleton @driving_adapter @US-2 — a failing browser open never crashes the launch (AC2.2)
  it('a browser-open FAILURE prints the URL and keeps serving (launch not crashed)', async () => {
    // PIXEL_AGENTS_OPEN_CMD names a missing opener to force the open to fail.
    // This is distinct from --no-open (which never attempts an open). Assert
    // the CLI still prints the URL and keeps serving.
    const port = await getFreePort();
    const child = launch(['--port', String(port)], {
      PIXEL_AGENTS_OPEN_CMD: 'definitely-not-a-real-command-xyz',
    });
    let out = '';
    child.stdout.on('data', (d: Buffer) => (out += d.toString()));
    child.stderr.on('data', (d: Buffer) => (out += d.toString()));
    await waitFor(async () => {
      if (child.exitCode !== null && child.exitCode !== 0) {
        throw new Error(`CLI crashed on browser-open failure:\n${out}`);
      }
      try {
        return (await fetch(`http://127.0.0.1:${port}/api/health`)).ok;
      } catch {
        return false;
      }
    });
    // The spawn error lands asynchronously; give it time to (not) crash us.
    await new Promise((r) => setTimeout(r, 500));
    expect(child.exitCode).toBeNull();
    expect(out).toContain(`http://127.0.0.1:${port}`);
  });

  // @driving_adapter @US-2 @US-4 — help documents the new flags (AC2.3)
  it('--help documents --no-open and --no-hooks and exits 0', async () => {
    const child = launch(['--help']);
    let out = '';
    child.stdout.on('data', (d: Buffer) => (out += d.toString()));
    await new Promise<void>((r) => child.once('close', () => r()));
    expect(out).toContain('--no-open');
    expect(out).toContain('--no-hooks');
    expect(child.exitCode).toBe(0);
  });
});
