/**
 * E2E test runner: writes apps/cicd config and runs WebdriverIO.
 *
 * Usage (from repo root):
 *   bun ci/run-e2e-test.ts --spec ./test/specs/hello.e2e.ts
 *
 * Config: artifacts/e2e/config.json
 * Logs and run summary: apps/cicd/run.ts
 */
import { $, Glob } from 'bun';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const E2E_ROOT = path.join(ROOT, 'apps/e2e');
const CONFIG_REL_PATH = 'artifacts/e2e/config.json';
const CONFIG_PATH = path.join(ROOT, CONFIG_REL_PATH);

function parseArgv(argv: string[]): string[] {
  const patterns: string[] = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    if (arg === '--spec') {
      const value = argv[i + 1];
      if (!value || value.startsWith('-')) {
        throw new Error('Missing value for --spec');
      }
      patterns.push(value);
      i += 1;
      continue;
    }
    if (arg.startsWith('--spec=')) {
      const value = arg.slice('--spec='.length);
      if (!value) {
        throw new Error('Missing value for --spec');
      }
      patterns.push(value);
      continue;
    }
    throw new Error(
      `Unknown argument: ${arg}\nUsage: bun ci/run-e2e-test.ts [--spec <glob-or-file> ...]`,
    );
  }
  return patterns;
}

function specFiles(patterns: string[], excludeManual: boolean): string[] {
  const files = new Set<string>();
  for (const pattern of patterns) {
    const glob = new Glob(pattern.replace(/\\/g, '/'));
    for (const match of glob.scanSync({ cwd: E2E_ROOT, absolute: false })) {
      if (excludeManual && match.includes('test/specs/manual/')) continue;
      if (match.endsWith('.ts')) files.add(match.replace(/\\/g, '/'));
    }
  }
  const resolved = [...files].sort();
  if (resolved.length === 0) {
    throw new Error(`No spec files matched: ${patterns.join(', ')}`);
  }
  return resolved;
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  const patterns = parseArgv(argv);
  const specs = specFiles(
    patterns.length > 0 ? patterns : ['test/specs/**/*.ts'],
    patterns.length === 0,
  );

  const env: Record<string, string> = {
    BROWSER_LOG_ENABLED: 'true',
    NETWORK_LOG_ENABLED: 'true',
    SMM_AUTH_TOKEN: process.env.SMM_AUTH_TOKEN ?? 'ChangeMe123',
  };
  if (process.env.EXTERNAL_CONFIG_FILE_URL) {
    env.EXTERNAL_CONFIG_FILE_URL = process.env.EXTERNAL_CONFIG_FILE_URL;
  }

  const config = {
    name: 'smm-e2e',
    outputDir: './artifacts/cicd',
    env,
    background: [
      { name: 'cli', command: 'pnpm e2e:cli', cwd: ROOT },
      { name: 'ui', command: 'pnpm dev:ui', cwd: ROOT },
    ],
    tasks: [
      { name: 'wait-ready', command: 'bun ci/wait-for-e2e-ready.ts', cwd: ROOT },
      ...specs.map((spec) => ({
        name: path.posix.basename(spec),
        command: `pnpm wdio --spec ./${spec}`,
        cwd: E2E_ROOT,
      })),
    ],
    afterEach: [
      {
        name: 'collect-wdio-report',
        command: 'bun ci/collect-wdio-report.ts',
        cwd: ROOT,
      },
    ],
    stopOnFailure: false,
    keepRawTimeline: true,
  };

  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));

  const result = await $`bun apps/cicd/run.ts -f ${CONFIG_REL_PATH} --cwd ${ROOT}`
    .cwd(ROOT)
    .env(process.env)
    .nothrow();

  return result.exitCode;
}

main()
  .then((exitCode) => process.exit(exitCode))
  .catch((error) => {
    console.error('failed:', error);
    process.exit(1);
  });
