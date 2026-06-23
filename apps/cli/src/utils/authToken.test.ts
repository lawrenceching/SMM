import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('isAuthEnabled', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns false when SMM_AUTH_ENABLED is unset', async () => {
    const { isAuthEnabled } = await import('./authToken');
    expect(isAuthEnabled()).toBe(false);
  });

  it.each([
    ['true', true],
    ['TRUE', true],
    ['  true  ', true],
    ['1', true],
    ['yes', true],
    ['YES', true],
    ['false', false],
    ['0', false],
    ['no', false],
    ['', false],
    ['enabled', false],
  ] as const)('returns %j → %s', async (value, expected) => {
    vi.stubEnv('SMM_AUTH_ENABLED', value);
    const { isAuthEnabled } = await import('./authToken');
    expect(isAuthEnabled()).toBe(expected);
  });
});

describe('resolveAuthToken', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns SMM_AUTH_TOKEN from env when set', async () => {
    vi.stubEnv('SMM_AUTH_TOKEN', 'fixed-secret');
    const { resolveAuthToken } = await import('./authToken');
    expect(resolveAuthToken()).toBe('fixed-secret');
  });

  it('trims whitespace from SMM_AUTH_TOKEN', async () => {
    vi.stubEnv('SMM_AUTH_TOKEN', '  trimmed-token  ');
    const { resolveAuthToken } = await import('./authToken');
    expect(resolveAuthToken()).toBe('trimmed-token');
  });

  it('generates a 64-char hex token when env is unset', async () => {
    const { resolveAuthToken } = await import('./authToken');
    const { logger } = await import('../../lib/logger');

    const token = resolveAuthToken();

    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(logger.info).toHaveBeenCalledWith(
      { token },
      'SMM_AUTH_TOKEN was not set; generated auth token (set SMM_AUTH_TOKEN to use a fixed value)',
    );
  });

  it('generates a token when SMM_AUTH_TOKEN is empty or whitespace', async () => {
    vi.stubEnv('SMM_AUTH_TOKEN', '   ');
    const { resolveAuthToken } = await import('./authToken');
    expect(resolveAuthToken()).toMatch(/^[0-9a-f]{64}$/);
  });

  it('returns the cached token on subsequent calls', async () => {
    vi.stubEnv('SMM_AUTH_TOKEN', 'fixed-secret');
    const { resolveAuthToken } = await import('./authToken');

    expect(resolveAuthToken()).toBe('fixed-secret');

    vi.stubEnv('SMM_AUTH_TOKEN', 'different-secret');
    expect(resolveAuthToken()).toBe('fixed-secret');
  });
});

describe('getAuthConfig', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('combines enabled flag and resolved token', async () => {
    vi.stubEnv('SMM_AUTH_ENABLED', 'true');
    vi.stubEnv('SMM_AUTH_TOKEN', 'my-token');
    const { getAuthConfig } = await import('./authToken');

    expect(getAuthConfig()).toEqual({
      enabled: true,
      token: 'my-token',
    });
  });
});
