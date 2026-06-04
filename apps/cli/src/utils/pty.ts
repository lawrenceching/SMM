// Lazy-resolved `node-pty` accessor.
//
// `node-pty` is a native addon; importing it eagerly at the top of every
// module would fail to compile/run on platforms where the prebuilt binary is
// missing. We resolve it once and cache the result. Callers that need to
// decide whether PTY is available should check {@link isPtyAvailable} rather
// than catching exceptions at the call site.

import { logger } from '../../lib/logger';

/**
 * Minimal subset of the `node-pty` API we depend on. Kept local to avoid
 * the type dependency leaking through the rest of the codebase.
 */
export interface IPty {
  pid: number;
  onData: (listener: (data: string) => void) => void;
  onExit: (listener: (e: { exitCode: number; signal?: number | string }) => void) => void;
  write: (data: string) => void;
  resize: (cols: number, rows: number) => void;
  kill: (signal?: string) => void;
}

export interface PtySpawnOptions {
  name?: string;
  cols?: number;
  rows?: number;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  useConpty?: boolean;
}

export interface PtyModule {
  spawn: (file: string, args: string[] | string, options?: PtySpawnOptions) => IPty;
}

let cachedModule: PtyModule | null = null;
let resolved = false;
let resolutionError: string | null = null;

function loadPtyModule(): PtyModule | null {
  try {
    // Use `require` so missing native bindings throw synchronously here,
    // and so we can wrap the result in a typed adapter.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('node-pty');
    if (!mod || typeof mod.spawn !== 'function') {
      throw new Error('node-pty module loaded but `spawn` is not a function');
    }
    return mod as PtyModule;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn({ err: message }, '[pty] node-pty is not available; will fall back to pipe spawn');
    return null;
  }
}

/**
 * Returns the loaded `node-pty` module, or `null` if it could not be loaded
 * (e.g. missing prebuilt binary). The result is cached after the first call.
 */
export function resolvePtyModule(): PtyModule | null {
  if (resolved) return cachedModule;
  resolved = true;
  cachedModule = loadPtyModule();
  if (cachedModule) {
    logger.debug('[pty] node-pty loaded successfully');
  } else {
    resolutionError = 'node-pty native module not available';
  }
  return cachedModule;
}

/**
 * `true` when `node-pty` was loaded successfully and is safe to use.
 */
export function isPtyAvailable(): boolean {
  return resolvePtyModule() !== null;
}

/**
 * Returns a human-readable reason for the last failed PTY load. Useful in
 * warning log entries when we silently fall back to pipe spawn.
 */
export function getPtyUnavailableReason(): string | null {
  if (isPtyAvailable()) return null;
  return resolutionError ?? 'node-pty native module not available';
}
