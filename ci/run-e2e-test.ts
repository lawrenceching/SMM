/**
 * E2E test runner: writes apps/cicd config and runs WebdriverIO.
 *
 * Usage (from repo root):
 *   bun ci/run-e2e-test.ts --spec ./test/specs/hello.e2e.ts
 *   bun ci/run-e2e-test.ts --platform ohos --spec ./ohos/tv/TVShow-Import.e2e.ts
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

type Platform = 'desktop' | 'ohos';

type ParsedArgs = {
  platform: Platform;
  patterns: string[];
};

const USAGE =
  'Usage: bun ci/run-e2e-test.ts [--platform desktop|ohos] [--spec <glob-or-file> ...]';

function parseArgv(argv: string[]): ParsedArgs {
  let platform: Platform = 'desktop';
  const patterns: string[] = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    if (arg === '--platform') {
      const value = argv[i + 1];
      if (!value || value.startsWith('-')) {
        throw new Error(`Missing value for --platform\n${USAGE}`);
      }
      if (value !== 'desktop' && value !== 'ohos') {
        throw new Error(`Invalid --platform ${value} (expected desktop|ohos)\n${USAGE}`);
      }
      platform = value;
      i += 1;
      continue;
    }
    if (arg.startsWith('--platform=')) {
      const value = arg.slice('--platform='.length);
      if (value !== 'desktop' && value !== 'ohos') {
        throw new Error(`Invalid --platform ${value} (expected desktop|ohos)\n${USAGE}`);
      }
      platform = value;
      continue;
    }
    if (arg === '--spec') {
      const value = argv[i + 1];
      if (!value || value.startsWith('-')) {
        throw new Error(`Missing value for --spec\n${USAGE}`);
      }
      patterns.push(value);
      i += 1;
      continue;
    }
    if (arg.startsWith('--spec=')) {
      const value = arg.slice('--spec='.length);
      if (!value) {
        throw new Error(`Missing value for --spec\n${USAGE}`);
      }
      patterns.push(value);
      continue;
    }
    throw new Error(`Unknown argument: ${arg}\n${USAGE}`);
  }

  return { platform, patterns };
}

function normalizeSpecPath(spec: string): string {
  return spec.replace(/\\/g, '/').replace(/^\.\//, '');
}

function isOhosSpec(spec: string): boolean {
  const normalized = normalizeSpecPath(spec);
  return normalized === 'ohos' || normalized.startsWith('ohos/');
}

function assertSpecsMatchPlatform(platform: Platform, specs: string[]): void {
  if (platform === 'ohos') {
    const nonOhos = specs.filter((s) => !isOhosSpec(s));
    if (nonOhos.length > 0) {
      throw new Error(
        `--platform ohos requires specs under ohos/, got: ${nonOhos.join(', ')}`,
      );
    }
    return;
  }

  const ohosSpecs = specs.filter((s) => isOhosSpec(s));
  if (ohosSpecs.length > 0) {
    throw new Error(
      `ohos specs require --platform ohos (got: ${ohosSpecs.join(', ')})`,
    );
  }
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

function buildDesktopConfig(specs: string[]) {
  const env: Record<string, string> = {
    BROWSER_LOG_ENABLED: 'true',
    NETWORK_LOG_ENABLED: 'true',
    SMM_AUTH_TOKEN: process.env.SMM_AUTH_TOKEN ?? 'ChangeMe123',
  };
  if (process.env.EXTERNAL_CONFIG_FILE_URL) {
    env.EXTERNAL_CONFIG_FILE_URL = process.env.EXTERNAL_CONFIG_FILE_URL;
  }

  return {
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
        command: `pnpm wdio --spec ./${normalizeSpecPath(spec)}`,
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
}

/**
 * Ohos attach profile: app must already be running on device.
 * WDIO uses ohos/wdio.conf.ts (hdc fport + hilog + CDP frontend console).
 */
function buildOhosConfig(specs: string[]) {
  const env: Record<string, string> = {
    SMM_AUTH_TOKEN: process.env.SMM_AUTH_TOKEN ?? 'ChangeMe123',
    OHOS_HILOG_CAPTURE: process.env.OHOS_HILOG_CAPTURE ?? 'true',
    OHOS_FRONTEND_CONSOLE_CAPTURE: process.env.OHOS_FRONTEND_CONSOLE_CAPTURE ?? 'true',
  };
  if (process.env.OHOS_REMOTE_DEBUG_PORT) {
    env.OHOS_REMOTE_DEBUG_PORT = process.env.OHOS_REMOTE_DEBUG_PORT;
  }
  if (process.env.HDC_PORT_FORWARD_ENABLED) {
    env.HDC_PORT_FORWARD_ENABLED = process.env.HDC_PORT_FORWARD_ENABLED;
  }

  return {
    name: 'smm-e2e-ohos',
    outputDir: './artifacts/cicd',
    env,
    background: [] as { name: string; command: string; cwd: string }[],
    tasks: specs.map((spec) => ({
      name: path.posix.basename(spec),
      command: `pnpm wdio:ohos --spec ./${normalizeSpecPath(spec)}`,
      cwd: E2E_ROOT,
    })),
    afterEach: [
      {
        name: 'collect-ohos-logs',
        command: 'bun ci/collect-ohos-logs.ts',
        cwd: ROOT,
      },
    ],
    stopOnFailure: false,
    keepRawTimeline: true,
  };
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  const { platform, patterns } = parseArgv(argv);
  const defaultPatterns =
    platform === 'ohos' ? ['ohos/**/*.e2e.ts'] : ['test/specs/**/*.ts'];
  const specs = specFiles(
    patterns.length > 0 ? patterns : defaultPatterns,
    patterns.length === 0 && platform === 'desktop',
  );
  assertSpecsMatchPlatform(platform, specs);

  const config =
    platform === 'ohos' ? buildOhosConfig(specs) : buildDesktopConfig(specs);

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
