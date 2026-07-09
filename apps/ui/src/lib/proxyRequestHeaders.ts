import { openrestyDateToken } from "./openrestyDateToken"

export type ProxyKind = "local" | "openresty"
export type ProxyAuthorizationMethod = "date-token" | "none"

export interface BuildProxyRequestHeadersInput {
  kind: ProxyKind
  upstreamBaseURL: string
  authorizationMethod: ProxyAuthorizationMethod
  /** Optional extra headers (e.g. upstream API key on Authorization) */
  extra?: Record<string, string>
}

export function buildProxyRequestHeaders(
  input: BuildProxyRequestHeadersInput,
): Record<string, string> {
  const upstream = input.upstreamBaseURL.replace(/\/+$/, "")
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(input.extra ?? {}),
  }

  if (input.kind === "local") {
    headers["X-SMM-Proxy-Upstream-BaseURL"] = upstream
    return headers
  }

  headers["X-Upstream-Base-Url"] = upstream
  if (input.authorizationMethod === "date-token") {
    headers["X-Proxy-Authorization"] = `Bearer ${openrestyDateToken()}`
  }
  return headers
}
