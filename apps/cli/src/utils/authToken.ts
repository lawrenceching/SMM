import { randomBytes } from 'node:crypto';
import type { CoreRoutesAuthConfig } from '@smm/core-routes';
import { logger } from '../../lib/logger';

let resolvedToken: string | null = null;

export function resolveAuthToken(): string {
  if (resolvedToken) {
    return resolvedToken;
  }

  const envToken = process.env.SMM_AUTH_TOKEN?.trim();
  if (envToken) {
    resolvedToken = envToken;
    return resolvedToken;
  }

  resolvedToken = randomBytes(32).toString('hex');
  logger.info(
    { token: resolvedToken },
    'SMM_AUTH_TOKEN was not set; generated auth token (set SMM_AUTH_TOKEN to use a fixed value)',
  );
  return resolvedToken;
}

export function isAuthEnabled(): boolean {
  const value = process.env.SMM_AUTH_ENABLED?.trim().toLowerCase();
  return value === 'true' || value === '1' || value === 'yes';
}

export function getAuthConfig(): CoreRoutesAuthConfig {
  return {
    enabled: isAuthEnabled(),
    token: resolveAuthToken(),
  };
}
