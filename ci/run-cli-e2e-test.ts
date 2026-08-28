/**
 * CLI e2e runner: `bun test` under `apps/e2e/cli` against `apps/cli/dist/cli`.
 *
 * Usage (from repo root):
 *   bun ci/run-cli-e2e-test.ts
 *   bun ci/run-cli-e2e-test.ts ./cli/tmdb.test.ts
 */
import { $ } from 'bun';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  DEFAULT_EMBEDDED_PROXY_ADDRESS,
  startEmbeddedHttpProxy,
  stopEmbeddedHttpProxy,
  useEmbeddedHttpProxy,
} from '../apps/e2e/test/lib/httpProxyServer.ts';
import { loadEnvLocal } from './load-env-local.ts';

const ROOT = path.resolve(import.meta.dir, '..');
const E2E_DIR = path.join(ROOT, 'apps/e2e');
const CLI_BIN = path.join(
  ROOT,
  'apps/cli/dist',
  process.platform === 'win32' ? 'cli.exe' : 'cli',
);

const DEFAULTS: Record<string, string> = {
  TMDB_HOST: 'https://api.themoviedb.org/3',
  TVDB_HOST: 'https://api4.thetvdb.com/v4',
};

function applyDefaultEnv(): void {
  for (const [key, value] of Object.entries(DEFAULTS)) {
    if (!process.env[key]?.trim()) {
      process.env[key] = value;
    }
  }
}

function ensureCliBinary(): void {
  if (!fs.existsSync(CLI_BIN)) {
    console.error(`CLI binary not found: ${CLI_BIN}`);
    console.error('Run: cd apps/cli && pnpm run build');
    process.exit(1);
  }
}

async function main(): Promise<number> {
  loadEnvLocal(ROOT);
  applyDefaultEnv();
  ensureCliBinary();

  const embedded = useEmbeddedHttpProxy();
  if (embedded) {
    await startEmbeddedHttpProxy(DEFAULT_EMBEDDED_PROXY_ADDRESS);
    if (!process.env.TMDB_HTTP_PROXY?.trim()) {
      process.env.TMDB_HTTP_PROXY = DEFAULT_EMBEDDED_PROXY_ADDRESS;
    }
    if (!process.env.TVDB_HTTP_PROXY?.trim()) {
      process.env.TVDB_HTTP_PROXY = DEFAULT_EMBEDDED_PROXY_ADDRESS;
    }
  }

  try {
    const extraArgs = process.argv.slice(2);
    const testArgs = extraArgs.length > 0 ? extraArgs : ['./cli/'];

    const result = await $`bun test ${testArgs}`.cwd(E2E_DIR).env(process.env).nothrow();
    return result.exitCode;
  } finally {
    if (embedded) {
      await stopEmbeddedHttpProxy();
    }
  }
}

main()
  .then((exitCode) => process.exit(exitCode))
  .catch((error) => {
    console.error('failed:', error);
    process.exit(1);
  });
