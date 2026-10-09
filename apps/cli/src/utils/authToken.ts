import { randomBytes } from 'node:crypto';
import type { CoreRoutesAuthConfig } from '@smm/core-routes';
import { isRunningInDocker, logger } from '@smm/server';

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
    `SMM_AUTH_TOKEN was not set, SMM generated auth token: ${resolvedToken}`,
  );
  return resolvedToken;
}

export function isAuthEnabled(): boolean {
  const raw = process.env.SMM_AUTH_ENABLED?.trim();
  if (raw !== undefined && raw !== '') {
    const value = raw.toLowerCase();
    return value === 'true' || value === '1' || value === 'yes';
  }
  // Docker exposes the full API on the network; require auth unless explicitly disabled.
  return isRunningInDocker();
}

export function getAuthConfig(): CoreRoutesAuthConfig {
  return {
    enabled: isAuthEnabled(),
    token: resolveAuthToken(),
  };
}
