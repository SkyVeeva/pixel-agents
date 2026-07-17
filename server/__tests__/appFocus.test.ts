import { describe, expect, it, vi } from 'vitest';

import {
  activateApp,
  appActivateCommand,
  focusViaUriOrApp,
  openUri,
  uriOpenCommand,
} from '../src/appFocus.js';

describe('appFocus command selection', () => {
  it('uriOpenCommand picks the right opener per platform', () => {
    expect(uriOpenCommand('claude://resume?session=x', 'darwin')).toEqual([
      'open',
      ['claude://resume?session=x'],
    ]);
    expect(uriOpenCommand('claude://x', 'win32')).toEqual([
      'cmd',
      ['/c', 'start', '', 'claude://x'],
    ]);
    expect(uriOpenCommand('claude://x', 'linux')).toEqual(['xdg-open', ['claude://x']]);
  });

  it('appActivateCommand picks the right activator per platform', () => {
    expect(appActivateCommand('Claude', 'darwin')).toEqual(['open', ['-a', 'Claude']]);
    expect(appActivateCommand('Claude', 'win32')).toEqual(['cmd', ['/c', 'start', '', 'Claude']]);
    expect(appActivateCommand('Claude', 'linux')).toEqual(['xdg-open', ['Claude']]);
  });
});

describe('appFocus dispatch', () => {
  it('openUri spawns the resolved command and unrefs', () => {
    const unref = vi.fn();
    const spawn = vi.fn(() => ({ unref }));
    openUri('claude://resume?session=abc', { platform: 'darwin', spawn });
    expect(spawn).toHaveBeenCalledWith('open', ['claude://resume?session=abc']);
    expect(unref).toHaveBeenCalledOnce();
  });

  it('activateApp spawns the resolved command', () => {
    const spawn = vi.fn(() => ({ unref: vi.fn() }));
    activateApp('Claude', { platform: 'win32', spawn });
    expect(spawn).toHaveBeenCalledWith('cmd', ['/c', 'start', '', 'Claude']);
  });

  it('never throws when spawn fails (best-effort)', () => {
    const spawn = vi.fn(() => {
      throw new Error('nope');
    });
    expect(() => openUri('claude://x', { platform: 'linux', spawn })).not.toThrow();
    expect(() => activateApp('Claude', { platform: 'linux', spawn })).not.toThrow();
  });

  it('focusViaUriOrApp opens the URI when present, else activates the app', () => {
    const spawn = vi.fn(() => ({ unref: vi.fn() }));

    focusViaUriOrApp('claude://resume?session=z', 'Claude', { platform: 'darwin', spawn });
    expect(spawn).toHaveBeenLastCalledWith('open', ['claude://resume?session=z']);

    focusViaUriOrApp(null, 'Claude', { platform: 'darwin', spawn });
    expect(spawn).toHaveBeenLastCalledWith('open', ['-a', 'Claude']);
  });
});
