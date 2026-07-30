import { describe, expect, test } from 'bun:test';
import {
  DEFAULT_DOCKER_UI_ORIGIN,
  DOCKER_UI_ORIGIN,
  HARMONYOS_UI_ORIGIN,
  resolveDockerUiOrigin,
  resolveUiPageUrl,
} from './ui-page-url.ts';
import { resolveHttpProxyProbeUrl } from './httpProxyServer.ts';

function withEnv(
  overrides: {
    SMM_AUTH_TOKEN?: string | undefined;
    E2E_PLATFORM?: string | undefined;
    E2E_DOCKER_UI_ORIGIN?: string | undefined;
    E2E_HTTP_PROXY_PROBE_URL?: string | undefined;
  },
  fn: () => void,
): void {
  const prevToken = process.env.SMM_AUTH_TOKEN;
  const prevPlatform = process.env.E2E_PLATFORM;
  const prevOrigin = process.env.E2E_DOCKER_UI_ORIGIN;
  const prevProbe = process.env.E2E_HTTP_PROXY_PROBE_URL;

  if ('SMM_AUTH_TOKEN' in overrides) {
    if (overrides.SMM_AUTH_TOKEN === undefined) delete process.env.SMM_AUTH_TOKEN;
    else process.env.SMM_AUTH_TOKEN = overrides.SMM_AUTH_TOKEN;
  }
  if ('E2E_PLATFORM' in overrides) {
    if (overrides.E2E_PLATFORM === undefined) delete process.env.E2E_PLATFORM;
    else process.env.E2E_PLATFORM = overrides.E2E_PLATFORM;
  }
  if ('E2E_DOCKER_UI_ORIGIN' in overrides) {
    if (overrides.E2E_DOCKER_UI_ORIGIN === undefined) delete process.env.E2E_DOCKER_UI_ORIGIN;
    else process.env.E2E_DOCKER_UI_ORIGIN = overrides.E2E_DOCKER_UI_ORIGIN;
  }
  if ('E2E_HTTP_PROXY_PROBE_URL' in overrides) {
    if (overrides.E2E_HTTP_PROXY_PROBE_URL === undefined) {
      delete process.env.E2E_HTTP_PROXY_PROBE_URL;
    } else {
      process.env.E2E_HTTP_PROXY_PROBE_URL = overrides.E2E_HTTP_PROXY_PROBE_URL;
    }
  }

  try {
    fn();
  } finally {
    if (prevToken === undefined) delete process.env.SMM_AUTH_TOKEN;
    else process.env.SMM_AUTH_TOKEN = prevToken;
    if (prevPlatform === undefined) delete process.env.E2E_PLATFORM;
    else process.env.E2E_PLATFORM = prevPlatform;
    if (prevOrigin === undefined) delete process.env.E2E_DOCKER_UI_ORIGIN;
    else process.env.E2E_DOCKER_UI_ORIGIN = prevOrigin;
    if (prevProbe === undefined) delete process.env.E2E_HTTP_PROXY_PROBE_URL;
    else process.env.E2E_HTTP_PROXY_PROBE_URL = prevProbe;
  }
}

describe('resolveUiPageUrl', () => {
  test('defaults to localhost with port from apps/ui/vite.config.ts', () => {
    withEnv({ SMM_AUTH_TOKEN: undefined, E2E_PLATFORM: undefined }, () => {
      expect(resolveUiPageUrl()).toBe('http://localhost:8000');
      expect(resolveUiPageUrl(undefined, 'general')).toBe('http://localhost:8000');
    });
  });

  test('HarmonyOS uses device-local MAIN_HTTP_ORIGIN', () => {
    withEnv({ SMM_AUTH_TOKEN: undefined, E2E_PLATFORM: undefined }, () => {
      expect(resolveUiPageUrl(undefined, 'HarmonyOS')).toBe(HARMONYOS_UI_ORIGIN);
    });
  });

  test('docker platform uses localhost:30000 when os is general', () => {
    withEnv(
      { SMM_AUTH_TOKEN: undefined, E2E_PLATFORM: 'docker', E2E_DOCKER_UI_ORIGIN: undefined },
      () => {
        expect(resolveUiPageUrl()).toBe(DOCKER_UI_ORIGIN);
        expect(resolveUiPageUrl(undefined, 'general')).toBe(DEFAULT_DOCKER_UI_ORIGIN);
      },
    );
  });

  test('docker platform respects E2E_DOCKER_UI_ORIGIN', () => {
    withEnv(
      {
        SMM_AUTH_TOKEN: undefined,
        E2E_PLATFORM: 'docker',
        E2E_DOCKER_UI_ORIGIN: 'http://127.0.0.1:30000',
      },
      () => {
        expect(resolveDockerUiOrigin()).toBe('http://127.0.0.1:30000/');
        expect(resolveUiPageUrl()).toBe('http://127.0.0.1:30000/');
      },
    );
  });

  test('docker platform appends token', () => {
    withEnv(
      { SMM_AUTH_TOKEN: 'ChangeMe123', E2E_PLATFORM: 'docker', E2E_DOCKER_UI_ORIGIN: undefined },
      () => {
        expect(resolveUiPageUrl()).toBe(`${DOCKER_UI_ORIGIN}?token=ChangeMe123`);
      },
    );
  });

  test('appends SMM_AUTH_TOKEN as query param', () => {
    withEnv({ SMM_AUTH_TOKEN: 'ChangeMe123', E2E_PLATFORM: undefined }, () => {
      expect(resolveUiPageUrl()).toBe('http://localhost:8000?token=ChangeMe123');
      expect(resolveUiPageUrl(undefined, 'HarmonyOS')).toBe(
        `${HARMONYOS_UI_ORIGIN}?token=ChangeMe123`,
      );
    });
  });

  test('uses explicit url when provided and still appends token', () => {
    withEnv({ SMM_AUTH_TOKEN: 'tok', E2E_PLATFORM: undefined }, () => {
      expect(resolveUiPageUrl('http://127.0.0.1:9000/')).toBe(
        'http://127.0.0.1:9000/?token=tok',
      );
    });
  });
});

describe('resolveHttpProxyProbeUrl', () => {
  test('returns proxyUrl when probe env unset', () => {
    withEnv({ E2E_HTTP_PROXY_PROBE_URL: undefined }, () => {
      expect(resolveHttpProxyProbeUrl('http://http-proxy:8990')).toBe('http://http-proxy:8990');
    });
  });

  test('prefers E2E_HTTP_PROXY_PROBE_URL when set', () => {
    withEnv({ E2E_HTTP_PROXY_PROBE_URL: 'http://127.0.0.1:8990' }, () => {
      expect(resolveHttpProxyProbeUrl('http://http-proxy:8990')).toBe('http://127.0.0.1:8990');
    });
  });
});
