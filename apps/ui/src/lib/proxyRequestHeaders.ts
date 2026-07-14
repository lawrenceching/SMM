import { openrestyDateToken } from "./openrestyDateToken"

export type ProxyAuthorizationMethod = "date-token" | "none"

interface ProxyRequestHeadersBase {
  upstreamBaseURL: string
  /** Optional extra headers (e.g. upstream API key on Authorization) */
  extra?: Record<string, string>
}

/** Headers for the local SMM CLI reverse proxy (`X-SMM-Proxy-Upstream-BaseURL`). */
export function buildLocalProxyRequestHeaders(
  input: ProxyRequestHeadersBase,
): Record<string, string> {
  const upstream = input.upstreamBaseURL.replace(/\/+$/, "")
  return {
    Accept: "application/json",
    ...(input.extra ?? {}),
    "X-SMM-Proxy-Upstream-BaseURL": upstream,
  }
}

/** Headers for remote general reverse proxies (`X-Upstream-Base-Url`, optional auth). */
export function buildGeneralProxyRequestHeaders(
  input: ProxyRequestHeadersBase & {
    authorizationMethod: ProxyAuthorizationMethod
  },
): Record<string, string> {
  const upstream = input.upstreamBaseURL.replace(/\/+$/, "")
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(input.extra ?? {}),
    "X-Upstream-Base-Url": upstream,
  }
  if (input.authorizationMethod === "date-token") {
    headers["X-Proxy-Authorization"] = `Bearer ${openrestyDateToken()}`
  }
  return headers
}
