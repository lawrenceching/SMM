import type { HelloResponseBody } from '@smm/types';
import { buildAuthorizationHeader } from '@/lib/authToken';
import { with401Suppressed } from '@/lib/authSession';
import { syncPathServerPlatformFromHello } from '@/lib/syncPathServerPlatform';

/**
 * Validates an auth token by calling GET /api/hello with an explicit Bearer header.
 * Does not persist the token — callers should use saveAuthToken on success.
 */
export async function verifyHelloWithToken(token: string): Promise<HelloResponseBody> {
  const trimmed = token.trim();
  if (!trimmed) {
    throw new Error('Auth token is required');
  }

  return with401Suppressed(async () => {
    const resp = await fetch('/api/hello', {
      method: 'GET',
      headers: {
        Authorization: buildAuthorizationHeader(trimmed),
      },
    });

    const body = (await resp.json()) as HelloResponseBody & { error?: string };

    if (resp.status === 401) {
      throw new Error('Unauthorized');
    }
    if (!resp.ok || body.error) {
      throw new Error(body.error ?? `HTTP ${resp.status}`);
    }

    syncPathServerPlatformFromHello(body);
    return body;
  });
}
