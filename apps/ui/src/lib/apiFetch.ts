import { buildAuthorizationHeader, getAuthToken } from '@/lib/authToken';
import { notifyUnauthorizedApiResponse } from '@/lib/authSession';

function resolveRequestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') {
    return input;
  }
  if (input instanceof URL) {
    return input.href;
  }
  return input.url;
}

export async function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const token = getAuthToken();
  const headers = new Headers(init?.headers);
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', buildAuthorizationHeader(token));
  }

  const response = await fetch(input, { ...init, headers });
  notifyUnauthorizedApiResponse(response, resolveRequestUrl(input));
  return response;
}
