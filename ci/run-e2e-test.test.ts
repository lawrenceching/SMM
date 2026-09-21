import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, test, beforeAll } from 'bun:test';
import {
  assertWebUiArtifactsExist,
  resolveWebUiArtifactPaths,
} from '../apps/e2e/web-ui-artifacts.ts';
import {
  assertSpecsMatchPlatform,
  assignE2eLocalPortEnv,
  buildConfig,
  dockerHttpProxyEnvForContainer,
  parseArgv,
  requireSpecsForPlatform,
  ROOT,
} from './run-e2e-test-lib.ts';

function ensureRootWebArtifactsStub(): void {
  const { cliBin, indexHtml } = resolveWebUiArtifactPaths(ROOT);
  fs.mkdirSync(path.dirname(cliBin), { recursive: true });
  fs.mkdirSync(path.dirname(indexHtml), { recursive: true });
  if (!fs.existsSync(cliBin)) fs.writeFileSync(cliBin, '');
  if (!fs.existsSync(indexHtml)) fs.writeFileSync(indexHtml, '<html></html>');
}

describe('assertWebUiArtifactsExist', () => {
  test('throws with build hints when CLI or UI dist is missing', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'smm-web-artifacts-'));
    expect(() => assertWebUiArtifactsExist(root)).toThrow(/pnpm --filter cli run build/);

    const { cliBin, indexHtml } = resolveWebUiArtifactPaths(root);
    fs.mkdirSync(path.dirname(cliBin), { recursive: true });
    fs.writeFileSync(cliBin, '');
    expect(() => assertWebUiArtifactsExist(root)).toThrow(/pnpm --filter ui run build/);

    fs.mkdirSync(path.dirname(indexHtml), { recursive: true });
    fs.writeFileSync(indexHtml, '<html></html>');
    expect(() => assertWebUiArtifactsExist(root)).not.toThrow();
  });
});

describe('run-e2e-test docker platform', () => {
  test('parseArgv accepts --platform docker with --spec', () => {
    const parsed = parseArgv([
      '--platform',
      'docker',
      '--spec',
      './common/movie/SearchMovie.e2e.ts',
    ]);
    expect(parsed.platform).toBe('docker');
    expect(parsed.patterns).toEqual(['./common/movie/SearchMovie.e2e.ts']);
  });

  test('docker without --spec is rejected by requireSpecsForPlatform', () => {
    const { platform, patterns } = parseArgv(['--platform', 'docker']);
    expect(platform).toBe('docker');
    expect(patterns).toEqual([]);
    expect(() => requireSpecsForPlatform(platform, patterns)).toThrow(/docker requires/);
  });

  test('assertSpecsMatchPlatform rejects ohos specs on docker', () => {
    expect(() => assertSpecsMatchPlatform('docker', ['ohos/layout.e2e.ts'])).toThrow(
      /ohos|platform-specific/,
    );
  });

  test('assertSpecsMatchPlatform rejects electron specs on docker', () => {
    expect(() =>
      assertSpecsMatchPlatform('docker', ['electron/hello.e2e.ts']),
    ).toThrow(/electron|platform-specific/);
  });

  test('buildConfig docker uses container background and wdio:docker', () => {
    const config = buildConfig('docker', ['common/movie/SearchMovie.e2e.ts']);
    expect(config.name).toBe('smm-e2e-docker');
    expect(config.env.E2E_PLATFORM).toBe('docker');
    expect(config.env.BROWSER_LOG_ENABLED).toBe('true');
    expect(config.env.NETWORK_LOG_ENABLED).toBe('true');
    expect(config.background).toHaveLength(1);
    expect(config.background[0]!.name).toBe('container');
    expect(config.background[0]!.command).toBe('bun ci/e2e-docker-container.ts');
    expect(config.tasks[0]!.command).toContain('wait-for-docker-e2e-ready');
    expect(config.tasks.some((t) => t.command.includes('wdio:docker'))).toBe(true);
    expect(config.afterEach[0]!.command).toContain('collect-wdio-report');
  });

  test('dockerHttpProxyEnvForContainer rewrites loopback to host.docker.internal', () => {
    const prev = process.env.TMDB_HTTP_PROXY;
    process.env.TMDB_HTTP_PROXY = 'http://127.0.0.1:7897';
    try {
      expect(dockerHttpProxyEnvForContainer('TMDB_HTTP_PROXY')).toBe(
        'http://host.docker.internal:7897/',
      );
    } finally {
      if (prev === undefined) delete process.env.TMDB_HTTP_PROXY;
      else process.env.TMDB_HTTP_PROXY = prev;
    }
  });

  test('buildConfig docker forwards rewritten TMDB_HTTP_PROXY', () => {
    const prev = process.env.TMDB_HTTP_PROXY;
    process.env.TMDB_HTTP_PROXY = 'http://127.0.0.1:7897';
    try {
      const config = buildConfig('docker', ['common/config/ConfigDialog-Settings.e2e.ts']);
      expect(config.env.TMDB_HTTP_PROXY).toBe('http://host.docker.internal:7897/');
    } finally {
      if (prev === undefined) delete process.env.TMDB_HTTP_PROXY;
      else process.env.TMDB_HTTP_PROXY = prev;
    }
  });

  test('dockerHttpProxyEnvForContainer leaves compose service URLs unchanged', () => {
    const prev = process.env.TMDB_HTTP_PROXY;
    process.env.TMDB_HTTP_PROXY = 'http://http-proxy:8990';
    try {
      expect(dockerHttpProxyEnvForContainer('TMDB_HTTP_PROXY')).toBe(
        'http://http-proxy:8990',
      );
    } finally {
      if (prev === undefined) delete process.env.TMDB_HTTP_PROXY;
      else process.env.TMDB_HTTP_PROXY = prev;
    }
  });

  test('buildConfig docker forwards E2E_DOCKER_UI_ORIGIN and probe URL', () => {
    const prevOrigin = process.env.E2E_DOCKER_UI_ORIGIN;
    const prevProbe = process.env.E2E_HTTP_PROXY_PROBE_URL;
    const prevProxy = process.env.TMDB_HTTP_PROXY;
    process.env.E2E_DOCKER_UI_ORIGIN = 'http://127.0.0.1:30000/';
    process.env.E2E_HTTP_PROXY_PROBE_URL = 'http://127.0.0.1:8990';
    process.env.TMDB_HTTP_PROXY = 'http://http-proxy:8990';
    try {
      const config = buildConfig('docker', ['common/config/ConfigDialog-Settings.e2e.ts']);
      expect(config.env.E2E_DOCKER_UI_ORIGIN).toBe('http://127.0.0.1:30000/');
      expect(config.env.E2E_HTTP_PROXY_PROBE_URL).toBe('http://127.0.0.1:8990');
      expect(config.env.TMDB_HTTP_PROXY).toBe('http://http-proxy:8990');
    } finally {
      if (prevOrigin === undefined) delete process.env.E2E_DOCKER_UI_ORIGIN;
      else process.env.E2E_DOCKER_UI_ORIGIN = prevOrigin;
      if (prevProbe === undefined) delete process.env.E2E_HTTP_PROXY_PROBE_URL;
      else process.env.E2E_HTTP_PROXY_PROBE_URL = prevProbe;
      if (prevProxy === undefined) delete process.env.TMDB_HTTP_PROXY;
      else process.env.TMDB_HTTP_PROXY = prevProxy;
    }
  });



  test('buildConfig desktop forwards UI_PORT and CLI_PORT from process.env', () => {
    const prevUi = process.env.UI_PORT;
    const prevCli = process.env.CLI_PORT;
    const prevPort = process.env.PORT;
    process.env.UI_PORT = '8081';
    process.env.CLI_PORT = '8082';
    process.env.PORT = '30000';
    try {
      const config = buildConfig('desktop', ['common/mcp/McpOther-RenameTaskFlow.e2e.ts']);
      expect(config.env.UI_PORT).toBe('8081');
      expect(config.env.CLI_PORT).toBe('8082');
      expect(config.env.PORT).toBe('30000');
    } finally {
      if (prevUi === undefined) delete process.env.UI_PORT;
      else process.env.UI_PORT = prevUi;
      if (prevCli === undefined) delete process.env.CLI_PORT;
      else process.env.CLI_PORT = prevCli;
      if (prevPort === undefined) delete process.env.PORT;
      else process.env.PORT = prevPort;
    }
  });

  test('assignE2eLocalPortEnv skips empty values', () => {
    const prevUi = process.env.UI_PORT;
    process.env.UI_PORT = '   ';
    try {
      const env: Record<string, string> = {};
      assignE2eLocalPortEnv(env);
      expect(env.UI_PORT).toBeUndefined();
    } finally {
      if (prevUi === undefined) delete process.env.UI_PORT;
      else process.env.UI_PORT = prevUi;
    }
  });
});

describe('run-e2e-test web platform', () => {
  beforeAll(() => {
    ensureRootWebArtifactsStub();
  });

  test('parseArgv accepts --platform web with --spec', () => {
    const parsed = parseArgv([
      '--platform',
      'web',
      '--spec',
      './common/config/ConfigDialog-Settings.e2e.ts',
    ]);
    expect(parsed.platform).toBe('web');
  });

  test('web without --spec is rejected by requireSpecsForPlatform', () => {
    const { platform, patterns } = parseArgv(['--platform', 'web']);
    expect(() => requireSpecsForPlatform(platform, patterns)).toThrow(/web requires/);
  });

  test('assertSpecsMatchPlatform rejects ohos specs on web', () => {
    expect(() => assertSpecsMatchPlatform('web', ['ohos/layout.e2e.ts'])).toThrow(
      /ohos|platform-specific/,
    );
  });

  test('buildConfig web uses cli --staticDir background and no Vite', () => {
    const config = buildConfig('web', ['common/config/ConfigDialog-Settings.e2e.ts']);
    expect(config.name).toBe('smm-e2e-web');
    expect(config.env.E2E_PLATFORM).toBe('web');
    expect(config.env.SMM_AUTH_ENABLED).toBe('true');
    expect(config.env.BROWSER_LOG_ENABLED).toBe('true');
    expect(config.env.NETWORK_LOG_ENABLED).toBe('true');
    expect(config.background).toHaveLength(1);
    expect(config.background[0]!.name).toBe('cli');
    expect(config.background[0]!.command).toContain('--staticDir');
    expect(config.background[0]!.command).toContain('--port 30000');
    expect(config.background[0]!.command).not.toContain('dev:ui');
    expect(config.background.some((b) => b.command.includes('dev:ui'))).toBe(false);
    expect(config.tasks[0]!.command).toContain('wait-for-web-e2e-ready');
    expect(
      config.tasks.some((t) => t.command.includes('pnpm wdio') && !t.command.includes('wdio:docker')),
    ).toBe(true);
    expect(config.afterEach[0]!.command).toContain('collect-wdio-report');
  });

  test('buildConfig web forwards E2E_WEB_UI_ORIGIN', () => {
    const prev = process.env.E2E_WEB_UI_ORIGIN;
    process.env.E2E_WEB_UI_ORIGIN = 'http://127.0.0.1:30000/';
    try {
      const config = buildConfig('web', ['common/config/ConfigDialog-Settings.e2e.ts']);
      expect(config.env.E2E_WEB_UI_ORIGIN).toBe('http://127.0.0.1:30000/');
    } finally {
      if (prev === undefined) delete process.env.E2E_WEB_UI_ORIGIN;
      else process.env.E2E_WEB_UI_ORIGIN = prev;
    }
  });
});
