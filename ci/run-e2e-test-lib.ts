/**
 * Pure helpers for ci/run-e2e-test.ts (argv, platform rules, cicd config builders).
 */
import { Glob } from 'bun';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assertWebUiArtifactsExist,
  resolveWebUiArtifactPaths,
} from '../apps/e2e/web-ui-artifacts.ts';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const E2E_ROOT = path.join(ROOT, 'apps/e2e');
export const CONFIG_REL_PATH = 'artifacts/e2e/config.json';
export const CONFIG_PATH = path.join(ROOT, CONFIG_REL_PATH);

export type Platform = 'desktop' | 'ohos' | 'electron' | 'docker' | 'web';

export type ParsedArgs = {
  platform: Platform;
  patterns: string[];
};

export type CicdHook = { name: string; command: string; cwd: string };

export type CicdConfig = {
  name: string;
  outputDir: string;
  env: Record<string, string>;
  background: CicdHook[];
  tasks: CicdHook[];
  afterEach: CicdHook[];
  stopOnFailure: boolean;
  keepRawTimeline: boolean;
  taskTimeout: number;
};

export const USAGE =
  'Usage: bun ci/run-e2e-test.ts [--platform desktop|ohos|electron|docker|web] [--spec <glob-or-file> ...]';

const PLATFORMS = new Set<Platform>(['desktop', 'ohos', 'electron', 'docker', 'web']);

/** Canonical port env keys for e2e / cicd (Vite page + unified CLI HTTP). */
export const E2E_PORT_ENV_KEYS = ['VITE_PORT', 'HTTP_PORT'] as const;

export type E2ePortEnvKey = (typeof E2E_PORT_ENV_KEYS)[number];

/** Forward `VITE_PORT` / `HTTP_PORT` into cicd task/background env. */
export function assignE2eLocalPortEnv(env: Record<string, string>): void {
  for (const key of E2E_PORT_ENV_KEYS) {
    const value = process.env[key]?.trim();
    if (value) {
      env[key] = value;
    }
  }
}

function parsePlatform(value: string): Platform {
  if (!PLATFORMS.has(value as Platform)) {
    throw new Error(
      `Invalid --platform ${value} (expected desktop|ohos|electron|docker|web)\n${USAGE}`,
    );
  }
  return value as Platform;
}

export function parseArgv(argv: string[]): ParsedArgs {
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

export function normalizeSpecPath(spec: string): string {
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

/** Specs under common/ can run on desktop, ohos, electron, and docker. */
function isCommonSpec(spec: string): boolean {
  const normalized = normalizeSpecPath(spec);
  return normalized === 'common' || normalized.startsWith('common/');
}

export function assertSpecsMatchPlatform(platform: Platform, specs: string[]): void {
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

  // desktop + docker + web: reject platform-exclusive ohos/electron specs
  const exclusive = specs.filter((s) => isOhosSpec(s) || isElectronSpec(s));
  if (exclusive.length > 0) {
    throw new Error(
      `platform-specific specs require matching --platform (got: ${exclusive.join(', ')})`,
    );
  }
}

export function requireSpecsForPlatform(platform: Platform, patterns: string[]): void {
  if (platform === 'docker' && patterns.length === 0) {
    throw new Error(`--platform docker requires at least one --spec\n${USAGE}`);
  }
  if (platform === 'web' && patterns.length === 0) {
    throw new Error(`--platform web requires at least one --spec\n${USAGE}`);
  }
}

export function defaultPatternsForPlatform(platform: Platform): string[] {
  if (platform === 'ohos') return ['ohos/**/*.e2e.ts'];
  if (platform === 'electron') return ['electron/**/*.e2e.ts'];
  if (platform === 'docker') {
    throw new Error(`--platform docker requires at least one --spec\n${USAGE}`);
  }
  if (platform === 'web') {
    throw new Error(`--platform web requires at least one --spec\n${USAGE}`);
  }
  return ['test/specs/**/*.ts', 'common/**/*.e2e.ts'];
}

export function specFiles(patterns: string[], excludeManual: boolean): string[] {
  const files = new Set<string>();
  for (const pattern of patterns) {
    const glob = new Glob(pattern.replace(/\\/g, '/'));
    for (const match of glob.scanSync({ cwd: E2E_ROOT, absolute: false })) {
      const normalizedMatch = match.replace(/\\/g, '/');
      if (
        excludeManual &&
        (normalizedMatch.includes('common/manual/') ||
          normalizedMatch.includes('test/specs/manual/'))
      ) {
        continue;
      }
      if (match.endsWith('.ts')) files.add(normalizedMatch);
    }
  }
  const resolved = [...files].sort();
  if (resolved.length === 0) {
    throw new Error(`No spec files matched: ${patterns.join(', ')}`);
  }
  return resolved;
}

/** Browser (Chrome) + local cli/ui — default when --platform is omitted. */
export function buildDesktopConfig(specs: string[]): CicdConfig {
  const env: Record<string, string> = {
    E2E_PLATFORM: 'desktop',
    BROWSER_LOG_ENABLED: 'true',
    NETWORK_LOG_ENABLED: 'true',
    SMM_AUTH_TOKEN: process.env.SMM_AUTH_TOKEN ?? 'ChangeMe123',
  };
  if (process.env.EXTERNAL_CONFIG_FILE_URL) {
    env.EXTERNAL_CONFIG_FILE_URL = process.env.EXTERNAL_CONFIG_FILE_URL;
  }
  assignE2eLocalPortEnv(env);

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
export function buildOhosConfig(specs: string[]): CicdConfig {
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
    background: [],
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
export function buildElectronConfig(specs: string[]): CicdConfig {
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
    background: [],
    tasks: specs.map((spec) => ({
      name: path.posix.basename(spec),
      command: `pnpm wdio:electron --spec ./${normalizeSpecPath(spec)}`,
      cwd: E2E_ROOT,
    })),
    afterEach: [],
    stopOnFailure: false,
    keepRawTimeline: true,
    taskTimeout: 30 * 60 * 1000,
  };
}

/**
 * Docker profile: managed `smm:latest` container, Chrome → :30000.
 * Requires explicit --spec (no default suite).
 */
/** Rewrite host-local proxy URLs so the container can reach the host forwarder. */
export function dockerHttpProxyEnvForContainer(envKey: 'TMDB_HTTP_PROXY' | 'TVDB_HTTP_PROXY'): string | undefined {
  const raw = process.env[envKey]?.trim();
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') {
      url.hostname = 'host.docker.internal';
      return url.toString();
    }
  } catch {
    // Keep the raw value when it is not a valid URL.
  }
  return raw;
}

function resolveWebListenPort(): number {
  const raw = process.env.HTTP_PORT?.trim();
  if (!raw) {
    return 30000;
  }
  const port = Number.parseInt(raw, 10);
  return Number.isFinite(port) && port > 0 ? port : 30000;
}

function resolveWebCliCommand(): string {
  assertWebUiArtifactsExist(ROOT);
  const { cliBin, staticDir } = resolveWebUiArtifactPaths(ROOT);
  return `"${cliBin}" --staticDir "${staticDir}" --port ${resolveWebListenPort()}`;
}

/**
 * Built cli + static ui dist on `HTTP_PORT` (default 30000). No Vite process is started.
 * `wait-for-web-e2e-ready` polls that unified HTTP port (page + `/api/hello`) only —
 * not `VITE_PORT`. If the server is down, the run stops before specs (`stopOnFailure`).
 * Requires explicit --spec (no default suite).
 */
export function buildWebConfig(specs: string[]): CicdConfig {
  const env: Record<string, string> = {
    E2E_PLATFORM: 'web',
    BROWSER_LOG_ENABLED: 'true',
    NETWORK_LOG_ENABLED: 'true',
    SMM_AUTH_ENABLED: 'true',
    SMM_AUTH_TOKEN: process.env.SMM_AUTH_TOKEN ?? 'ChangeMe123',
  };
  if (process.env.EXTERNAL_CONFIG_FILE_URL) {
    env.EXTERNAL_CONFIG_FILE_URL = process.env.EXTERNAL_CONFIG_FILE_URL;
  }
  if (process.env.E2E_WEB_UI_ORIGIN?.trim()) {
    env.E2E_WEB_UI_ORIGIN = process.env.E2E_WEB_UI_ORIGIN.trim();
  }
  if (process.env.TMDB_API_KEY?.trim()) env.TMDB_API_KEY = process.env.TMDB_API_KEY.trim();
  if (process.env.TVDB_API_KEY?.trim()) env.TVDB_API_KEY = process.env.TVDB_API_KEY.trim();
  assignE2eLocalPortEnv(env);

  return {
    name: 'smm-e2e-web',
    outputDir: './artifacts/cicd',
    env,
    background: [
      {
        name: 'cli',
        command: resolveWebCliCommand(),
        cwd: ROOT,
      },
    ],
    tasks: [
      { name: 'wait-ready', command: 'bun ci/wait-for-web-e2e-ready.ts', cwd: ROOT },
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
    stopOnFailure: true,
    keepRawTimeline: true,
    taskTimeout: 30 * 60 * 1000,
  };
}

export function buildDockerConfig(specs: string[]): CicdConfig {
  const env: Record<string, string> = {
    E2E_PLATFORM: 'docker',
    BROWSER_LOG_ENABLED: 'true',
    NETWORK_LOG_ENABLED: 'true',
    SMM_AUTH_TOKEN: process.env.SMM_AUTH_TOKEN ?? 'ChangeMe123',
  };
  if (process.env.EXTERNAL_CONFIG_FILE_URL) {
    env.EXTERNAL_CONFIG_FILE_URL = process.env.EXTERNAL_CONFIG_FILE_URL;
  }
  if (process.env.E2E_DOCKER_UI_ORIGIN?.trim()) {
    env.E2E_DOCKER_UI_ORIGIN = process.env.E2E_DOCKER_UI_ORIGIN.trim();
  }
  if (process.env.E2E_HTTP_PROXY_PROBE_URL?.trim()) {
    env.E2E_HTTP_PROXY_PROBE_URL = process.env.E2E_HTTP_PROXY_PROBE_URL.trim();
  }
  // Forward API keys into cicd task env (CI secrets / local .env.local).
  if (process.env.TMDB_API_KEY?.trim()) {
    env.TMDB_API_KEY = process.env.TMDB_API_KEY.trim();
  }
  if (process.env.TVDB_API_KEY?.trim()) {
    env.TVDB_API_KEY = process.env.TVDB_API_KEY.trim();
  }
  if (process.env.TMDB_HOST?.trim()) {
    env.TMDB_HOST = process.env.TMDB_HOST.trim();
  }
  if (process.env.TVDB_HOST?.trim()) {
    env.TVDB_HOST = process.env.TVDB_HOST.trim();
  }
  const tmdbHttpProxy = dockerHttpProxyEnvForContainer('TMDB_HTTP_PROXY');
  if (tmdbHttpProxy) {
    env.TMDB_HTTP_PROXY = tmdbHttpProxy;
  }
  const tvdbHttpProxy = dockerHttpProxyEnvForContainer('TVDB_HTTP_PROXY');
  if (tvdbHttpProxy) {
    env.TVDB_HTTP_PROXY = tvdbHttpProxy;
  }

  return {
    name: 'smm-e2e-docker',
    outputDir: './artifacts/cicd',
    env,
    background: [
      { name: 'container', command: 'bun ci/e2e-docker-container.ts', cwd: ROOT },
    ],
    tasks: [
      {
        name: 'wait-ready',
        command: 'bun ci/wait-for-docker-e2e-ready.ts',
        cwd: ROOT,
      },
      ...specs.map((spec) => ({
        name: path.posix.basename(spec),
        command: `pnpm wdio:docker --spec ./${normalizeSpecPath(spec)}`,
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

export function buildConfig(platform: Platform, specs: string[]): CicdConfig {
  if (platform === 'ohos') return buildOhosConfig(specs);
  if (platform === 'electron') return buildElectronConfig(specs);
  if (platform === 'docker') return buildDockerConfig(specs);
  if (platform === 'web') return buildWebConfig(specs);
  return buildDesktopConfig(specs);
}
