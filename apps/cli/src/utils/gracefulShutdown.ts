import { logger } from '../../lib/logger';

let shutdownInProgress = false;
let stopServerFn: (() => Promise<void>) | null = null;

export function registerGracefulShutdown(options: {
  stopServer: () => Promise<void>;
}): void {
  stopServerFn = options.stopServer;

  const onSignal = (signal: NodeJS.Signals) => {
    void runGracefulShutdown({ signal, exitProcess: true });
  };

  process.once('SIGINT', onSignal);
  process.once('SIGTERM', onSignal);
}

export function isShutdownInProgress(): boolean {
  return shutdownInProgress;
}

export async function runGracefulShutdown(options?: {
  signal?: string;
  exitProcess?: boolean;
}): Promise<{ ok: boolean; alreadyShuttingDown: boolean }> {
  if (shutdownInProgress) {
    return { ok: true, alreadyShuttingDown: true };
  }

  shutdownInProgress = true;

  try {
    logger.info({ signal: options?.signal }, 'graceful shutdown started');
    if (stopServerFn) {
      await stopServerFn();
    }
    logger.info('graceful shutdown completed');
    return { ok: true, alreadyShuttingDown: false };
  } catch (err) {
    logger.warn({ err }, 'graceful shutdown failed');
    return { ok: false, alreadyShuttingDown: false };
  } finally {
    if (options?.exitProcess) {
      process.exit(0);
    }
  }
}

export function scheduleProcessExit(): void {
  setImmediate(() => {
    process.exit(0);
  });
}

/** Resets module state between unit tests. */
export function resetGracefulShutdownStateForTests(): void {
  shutdownInProgress = false;
  stopServerFn = null;
}

const LOOPBACK_HOST_PATTERN =
  /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;

export function isLoopbackAddress(address: string): boolean {
  const normalized = address.toLowerCase();
  return (
    normalized === '127.0.0.1' ||
    normalized === '::1' ||
    normalized === '::ffff:127.0.0.1'
  );
}

export function isLocalhostShutdownRequest(
  req: Request,
  requestIP?: (req: Request) => { address: string } | null,
): boolean {
  const host = (req.headers.get('host') ?? '').split(',')[0]?.trim() ?? '';
  if (!LOOPBACK_HOST_PATTERN.test(host)) {
    return false;
  }

  if (requestIP) {
    const client = requestIP(req);
    const address = client?.address;
    if (address && !isLoopbackAddress(address)) {
      return false;
    }
  }

  return true;
}
