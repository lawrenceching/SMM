import { timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { sendJson } from "./http.ts";
import type { CoreRoutesAuthConfig, CoreRoutesConfig } from "./types.ts";

export function parseBearerToken(
  authorizationHeader: string | string[] | undefined,
): string | null {
  const raw = Array.isArray(authorizationHeader)
    ? authorizationHeader[0]
    : authorizationHeader;
  if (!raw) {
    return null;
  }
  const match = /^Bearer\s+(.+)$/i.exec(raw.trim());
  const token = match?.[1]?.trim();
  return token ? token : null;
}

export function isAuthTokenValid(
  authorizationHeader: string | string[] | undefined,
  expectedToken: string,
): boolean {
  const token = parseBearerToken(authorizationHeader);
  if (!token) {
    return false;
  }
  const provided = Buffer.from(token, "utf8");
  const expected = Buffer.from(expectedToken, "utf8");
  if (provided.length !== expected.length) {
    return false;
  }
  return timingSafeEqual(provided, expected);
}

export function rejectUnauthorized(res: ServerResponse): void {
  sendJson(res, 401, { error: "Unauthorized: invalid or missing token" });
}

/**
 * When auth is enabled and the request is unauthorized, writes 401 and returns true.
 * Otherwise returns false so routing can continue.
 */
export function enforceCoreRoutesAuth(
  req: IncomingMessage,
  res: ServerResponse,
  config: CoreRoutesConfig,
): boolean {
  const auth = config.auth;
  if (!auth?.enabled) {
    return false;
  }
  if (req.method === "OPTIONS") {
    return false;
  }
  if (isAuthTokenValid(req.headers.authorization, auth.token)) {
    return false;
  }
  rejectUnauthorized(res);
  return true;
}

export function isRequestAuthorized(
  authorizationHeader: string | undefined,
  auth: CoreRoutesAuthConfig | undefined,
): boolean {
  if (!auth?.enabled) {
    return true;
  }
  return isAuthTokenValid(authorizationHeader, auth.token);
}
