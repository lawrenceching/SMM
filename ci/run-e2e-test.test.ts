import { describe, expect, test } from 'bun:test';
import {
  assertSpecsMatchPlatform,
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
});
