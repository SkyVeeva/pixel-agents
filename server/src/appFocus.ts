/**
 * Generic, provider-agnostic OS launcher for "focus an app / open a URI".
 * Used by the focus layer to front a desktop app (Claude.app) via a `claude://`
 * deep link, or to just bring the app forward when no deep link exists.
 *
 * The `spawn` and `platform` are injectable so this is unit-testable without
 * actually launching anything, and so a host can route through its own opener
 * (e.g. VS Code's `env.openExternal`) if it prefers.
 */
import { spawn as nodeSpawn } from 'child_process';

/** Minimal spawn signature we depend on (detached, output ignored). */
export type SpawnLike = (command: string, args: string[]) => { unref?: () => void };

export interface AppFocusOptions {
  platform?: NodeJS.Platform;
  spawn?: SpawnLike;
}

function defaultSpawn(command: string, args: string[]): { unref?: () => void } {
  const child = nodeSpawn(command, args, { detached: true, stdio: 'ignore' });
  return child;
}

/** Resolve the OS command+args to open an arbitrary URI (registered handler). */
export function uriOpenCommand(uri: string, platform: NodeJS.Platform): [string, string[]] {
  switch (platform) {
    case 'darwin':
      return ['open', [uri]];
    case 'win32':
      // `start` is a cmd builtin; the empty "" is the (ignored) window title.
      return ['cmd', ['/c', 'start', '', uri]];
    default:
      return ['xdg-open', [uri]];
  }
}

/** Resolve the OS command+args to bring a named application to the foreground. */
export function appActivateCommand(appName: string, platform: NodeJS.Platform): [string, string[]] {
  switch (platform) {
    case 'darwin':
      return ['open', ['-a', appName]];
    case 'win32':
      return ['cmd', ['/c', 'start', '', appName]];
    default:
      // Best-effort on Linux: many desktops expose the app by lowercased name.
      return ['xdg-open', [appName]];
  }
}

/** Open a URI via the OS's registered handler. Best-effort; errors are swallowed
 *  so a focus click can never crash the host. */
export function openUri(uri: string, opts: AppFocusOptions = {}): void {
  const platform = opts.platform ?? process.platform;
  const spawn = opts.spawn ?? defaultSpawn;
  const [command, args] = uriOpenCommand(uri, platform);
  try {
    spawn(command, args).unref?.();
  } catch {
    /* focus is best-effort; never throw */
  }
}

/** Bring a named app to the foreground. Best-effort; errors swallowed. */
export function activateApp(appName: string, opts: AppFocusOptions = {}): void {
  const platform = opts.platform ?? process.platform;
  const spawn = opts.spawn ?? defaultSpawn;
  const [command, args] = appActivateCommand(appName, platform);
  try {
    spawn(command, args).unref?.();
  } catch {
    /* best-effort */
  }
}

/** Focus a session: open its deep link when one exists, else front the app so
 *  the click always does *something*. */
export function focusViaUriOrApp(
  uri: string | null,
  appName: string,
  opts: AppFocusOptions = {},
): void {
  if (uri) openUri(uri, opts);
  else activateApp(appName, opts);
}
