/**
 * E2E test runner: writes apps/cicd config and runs WebdriverIO.
 *
 * Usage (from repo root):
 *   bun ci/run-e2e-test.ts --spec ./test/specs/hello.e2e.ts
 *   bun ci/run-e2e-test.ts --spec ./common/tv/TVShow-Import.e2e.ts
 *   bun ci/run-e2e-test.ts --platform ohos --spec ./common/tv/TVShow-Import.e2e.ts
 *   bun ci/run-e2e-test.ts --platform electron --spec ./common/tv/TVShow-Import.e2e.ts
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

type Platform = 'desktop' | 'ohos' | 'electron';

type ParsedArgs = {
  platform: Platform;
  patterns: string[];
};

const USAGE =
  'Usage: bun ci/run-e2e-test.ts [--platform desktop|ohos|electron] [--spec <glob-or-file> ...]';

const PLATFORMS = new Set<Platform>(['desktop', 'ohos', 'electron']);

function parsePlatform(value: string): Platform {
  if (!PLATFORMS.has(value as Platform)) {
    throw new Error(`Invalid --platform ${value} (expected desktop|ohos|electron)\n${USAGE}`);
  }
  return value as Platform;
}

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
      platform = parsePlatform(value);
      i += 1;
      continue;
    }
    if (arg.startsWith('--platform=')) {
      platform = parsePlatform(arg.slice('--platform='.length));
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

function isElectronSpec(spec: string): boolean {
  const normalized = normalizeSpecPath(spec);
  return normalized === 'electron' || normalized.startsWith('electron/');
}

/** Specs under common/ can run on desktop, ohos, and electron. */
function isCommonSpec(spec: string): boolean {
  const normalized = normalizeSpecPath(spec);
  return normalized === 'common' || normalized.startsWith('common/');
}

function assertSpecsMatchPlatform(platform: Platform, specs: string[]): void {
  if (platform === 'ohos') {
    const invalid = specs.filter((s) => !isOhosSpec(s) && !isCommonSpec(s));
    if (invalid.length > 0) {
      throw new Error(
        `--platform ohos requires specs under ohos/ or common/, got: ${invalid.join(', ')}`,
      );
    }
    return;
  }

  if (platform === 'electron') {
    const invalid = specs.filter((s) => !isElectronSpec(s) && !isCommonSpec(s));
    if (invalid.length > 0) {
      throw new Error(
        `--platform electron requires specs under electron/ or common/, got: ${invalid.join(', ')}`,
      );
    }
    return;
  }

  const exclusive = specs.filter((s) => isOhosSpec(s) || isElectronSpec(s));
  if (exclusive.length > 0) {
    throw new Error(
      `platform-specific specs require matching --platform (got: ${exclusive.join(', ')})`,
    );
  }
}

function defaultPatternsForPlatform(platform: Platform): string[] {
  if (platform === 'ohos') return ['ohos/**/*.e2e.ts'];
  if (platform === 'electron') return ['electron/**/*.e2e.ts'];
  return ['test/specs/**/*.ts'];
}

function specFiles(patterns: string[], excludeManual: boolean): string[] {
  const files = new Set<string>();
  for (const pattern of patterns) {
    const glob = new Glob(pattern.replace(/\\/g, '/'));
    for (const match of glob.scanSync({ cwd: E2E_ROOT, absolute: false })) {
      if (
        excludeManual &&
        (match.includes('common/manual/') || match.includes('test/specs/manual/'))
      ) {
        continue;
      }
      if (match.endsWith('.ts')) files.add(match.replace(/\\/g, '/'));
    }
  }
  const resolved = [...files].sort();
  if (resolved.length === 0) {
    throw new Error(`No spec files matched: ${patterns.join(', ')}`);
  }
  return resolved;
}

/** Browser (Chrome) + local cli/ui — default when --platform is omitted. */
function buildDesktopConfig(specs: string[]) {
  const env: Record<string, string> = {
    E2E_PLATFORM: 'desktop',
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
    taskTimeout: 30 * 60 * 1000,
  };
}

/**
 * Ohos attach profile: app must already be running on device.
 * WDIO uses ohos/wdio.conf.ts (hdc fport + hilog + CDP frontend console).
 */
function buildOhosConfig(specs: string[]) {
  const env: Record<string, string> = {
    E2E_PLATFORM: 'ohos',
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
    taskTimeout: 30 * 60 * 1000,
  };
}

/**
 * Installed SMM Electron app (wdio-electron-service).
 * Does not start cli/ui — the binary embeds both.
 */
function buildElectronConfig(specs: string[]) {
  const env: Record<string, string> = {
    E2E_PLATFORM: 'electron',
    SMM_AUTH_TOKEN: process.env.SMM_AUTH_TOKEN ?? 'ChangeMe123',
  };
  if (process.env.SMM_ELECTRON_BINARY) {
    env.SMM_ELECTRON_BINARY = process.env.SMM_ELECTRON_BINARY;
  }
  if (process.env.EXTERNAL_CONFIG_FILE_URL) {
    env.EXTERNAL_CONFIG_FILE_URL = process.env.EXTERNAL_CONFIG_FILE_URL;
  }

  return {
    name: 'smm-e2e-electron',
    outputDir: './artifacts/cicd',
    env,
    background: [] as { name: string; command: string; cwd: string }[],
    tasks: specs.map((spec) => ({
      name: path.posix.basename(spec),
      command: `pnpm wdio:electron --spec ./${normalizeSpecPath(spec)}`,
      cwd: E2E_ROOT,
    })),
    afterEach: [] as { name: string; command: string; cwd: string }[],
    stopOnFailure: false,
    keepRawTimeline: true,
    taskTimeout: 30 * 60 * 1000,
  };
}

function buildConfig(platform: Platform, specs: string[]) {
  if (platform === 'ohos') return buildOhosConfig(specs);
  if (platform === 'electron') return buildElectronConfig(specs);
  return buildDesktopConfig(specs);
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  const { platform, patterns } = parseArgv(argv);
  const specs = specFiles(
    patterns.length > 0 ? patterns : defaultPatternsForPlatform(platform),
    patterns.length === 0 && platform === 'desktop',
  );
  assertSpecsMatchPlatform(platform, specs);

  const config = buildConfig(platform, specs);

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
