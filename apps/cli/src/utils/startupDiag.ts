import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { logger } from '../../lib/logger';

/**
 * Permanent CLI startup diagnostics for Electron-packaged Bun binaries.
 *
 * Why console.log in addition to pino:
 * Electron spawns the CLI with LOG_TARGET=file, so pino only writes smm.log.
 * CliProcessMonitor (and the Startup Error page) only see child stdout/stderr.
 * Milestone lines must therefore always go to stdout so a hang can be attributed
 * to the last completed phase when HTTP never becomes ready.
 *
 * Keep this module: intermittent Mac CI failures have included both
 * "stuck before listen" and "listen done but readiness probe fails" cases.
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
  console.log(line);
  try {
    logger.info({ session, phase, ...detail }, `${PREFIX} ${phase}`);
  } catch {
    // Logger may not be ready during very early bootstrap; console line is enough.
  }
}

/** Log whether the Electron-bundled UI index exists next to staticDir. */
export function startupDiagStaticIndex(root: string): void {
  const indexPath = join(root, 'index.html');
  startupDiag('ui-static-index', {
    root,
    indexPath,
    indexExists: existsSync(indexPath),
  });
}
