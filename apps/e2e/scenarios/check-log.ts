/**
 * onArtifactsReady hook: assert ScrapeFailover.e2e.ts logs contain
 * evidence of TMDB asset server failover.
 *
 * Verifies two groups of log lines in cli.log:
 *   1. Download attempts to wronghost.tmdb.local (the overridden host) — proves
 *      the debug override was in effect.
 *   2. Download attempts to a different host — proves the frontend fell back
 *      to the configured/default asset server after the first host failed.
 *
 * Env (from apps/cicd onArtifactsReady):
 *   CICD_ARTIFACT_DIR — run artifact directory (e.g. artifacts/cicd/<commandId>)
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

const TASK_NAME = 'ScrapeFailover.e2e.ts';
const LOG_PREFIX = '[DownloadImageAsFile]';
const WRONG_HOST = 'wronghost.tmdb.local';

interface HostCount {
  wronghost: number;
  failover: number;
  byHost: Record<string, number>;
}

function countHosts(lines: string[]): HostCount {
  let wronghost = 0;
  const byHost: Record<string, number> = {};

  for (const line of lines) {
    if (!line.includes(LOG_PREFIX)) continue;

    const match = line.match(/Downloading image from https?:\/\/([^/]+)/);
    if (!match) continue;

    const host = match[1];
    byHost[host] = (byHost[host] ?? 0) + 1;

    if (host === WRONG_HOST) {
      wronghost++;
    }
  }

  // "failover" count = downloads to any host that is NOT wronghost.tmdb.local
  const failover = Object.entries(byHost)
    .filter(([h]) => h !== WRONG_HOST)
    .reduce((sum, [, c]) => sum + c, 0);

  return { wronghost, failover, byHost };
}

function main(): number {
  const artifactDir = process.env.CICD_ARTIFACT_DIR;
  if (!artifactDir) {
    console.error('[check-log] missing CICD_ARTIFACT_DIR');
    return 1;
  }

  const mainLog = path.join(artifactDir, TASK_NAME, 'main.log');
  if (!fs.existsSync(mainLog)) {
    console.error(`[check-log] expected log not found: ${mainLog}`);
    return 1;
  }

  const body = fs.readFileSync(mainLog, 'utf8');
  const EXPECTED_SNIPPET = 'RUNNING in chrome';
  if (!body.includes(EXPECTED_SNIPPET)) {
    console.error(
      `[check-log] expected "${EXPECTED_SNIPPET}" in ${mainLog}, but it was not found`,
    );
    return 1;
  }

  console.log(`[check-log] ok: found "${EXPECTED_SNIPPET}" in ${mainLog}`);

  // --- Failover verification ---

  const cliLog = path.join(artifactDir, TASK_NAME, 'cli.log');
  if (!fs.existsSync(cliLog)) {
    console.error(`[check-log] expected log not found: ${cliLog}`);
    return 1;
  }

  const cliLines = fs.readFileSync(cliLog, 'utf8').split('\n');
  const counts = countHosts(cliLines);

  console.log('[check-log] image download host distribution:', counts.byHost);

  if (counts.wronghost === 0) {
    console.error(
      `[check-log] no downloads to "${WRONG_HOST}" found in ${cliLog} — ` +
        'the debug override may not have taken effect',
    );
    return 1;
  }

  if (counts.failover === 0) {
    console.error(
      `[check-log] all ${LOG_PREFIX} lines target "${WRONG_HOST}" — ` +
        'no evidence of failover to another asset server in ' + cliLog,
    );
    return 1;
  }

  // Every image should have at least one wronghost attempt AND one failover
  // attempt — warn if the distribution looks suspicious.
  if (counts.wronghost !== counts.failover) {
    console.warn(
      `[check-log] warning: wronghost downloads (${counts.wronghost}) ` +
        `don't match failover downloads (${counts.failover}) — ` +
        'some images may have been served without failing over',
    );
  }

  console.log(
    `[check-log] ok: ${counts.wronghost} attempts to "${WRONG_HOST}" + ` +
      `${counts.failover} failover downloads to other host(s)`,
  );
  return 0;
}

process.exit(main());
