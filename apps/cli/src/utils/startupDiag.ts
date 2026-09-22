import { logger } from '../../lib/logger';

/**
 * Startup diagnostics for Electron-spawned Bun CLI.
 *
 * Electron sets LOG_TARGET=file, so pino progress never reaches the child's
 * stdout that CliProcessMonitor captures. Milestone lines always go to
 * console.log so a Startup Error page can show the last phase before a hang.
 */
const PREFIX = '[SMM-STARTUP]';

export function getStartupSessionId(): string {
  return process.env.SMM_STARTUP_SESSION?.trim() || `pid-${process.pid}`;
}

export function startupDiag(phase: string, detail?: Record<string, unknown>): void {
  const session = getStartupSessionId();
  const detailText =
    detail && Object.keys(detail).length > 0 ? ` ${JSON.stringify(detail)}` : '';
  const line = `${PREFIX} session=${session} phase=${phase}${detailText}`;
  // Always stdout — Electron CliProcessMonitor captures this even with LOG_TARGET=file.
  console.log(line);
  try {
    logger.info({ session, phase, ...detail }, `${PREFIX} ${phase}`);
  } catch {
    // Logger may not be ready during very early bootstrap; console line is enough.
  }
}
