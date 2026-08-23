import { describe, expect, test } from 'bun:test';
import {
  assertSpecsMatchPlatform,
  assignE2eLocalPortEnv,
  buildConfig,
  dockerHttpProxyEnvForContainer,
  parseArgv,
  requireSpecsForPlatform,
} from './run-e2e-test-lib.ts';

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

  test('buildConfig forwards E2E_SMM_V3=true into cicd env', () => {
    const prev = process.env.E2E_SMM_V3;
    process.env.E2E_SMM_V3 = 'true';
    try {
      expect(buildConfig('desktop', ['common/tv/Scrape.e2e.ts']).env.E2E_SMM_V3).toBe('true');
      expect(buildConfig('docker', ['common/tv/Scrape.e2e.ts']).env.E2E_SMM_V3).toBe('true');
      expect(buildConfig('electron', ['common/tv/Scrape.e2e.ts']).env.E2E_SMM_V3).toBe('true');
      expect(buildConfig('ohos', ['common/tv/Scrape.e2e.ts']).env.E2E_SMM_V3).toBe('true');
    } finally {
      if (prev === undefined) delete process.env.E2E_SMM_V3;
      else process.env.E2E_SMM_V3 = prev;
    }
  });

  test('buildConfig omits E2E_SMM_V3 when unset', () => {
    const prev = process.env.E2E_SMM_V3;
    delete process.env.E2E_SMM_V3;
    try {
      expect(buildConfig('desktop', ['common/tv/Scrape.e2e.ts']).env.E2E_SMM_V3).toBeUndefined();
    } finally {
      if (prev === undefined) delete process.env.E2E_SMM_V3;
      else process.env.E2E_SMM_V3 = prev;
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
