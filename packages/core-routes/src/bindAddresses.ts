const DEFAULT_BIND_ADDRESS = "127.0.0.1";

/**
 * Hostname/IP for the main Web UI / API server (e.g. port 30000).
 * Env: `WEBUI_ADDRESS` — defaults to `127.0.0.1` (localhost only).
 */
export function resolveWebUiBindAddress(): string {
  const fromEnv = process.env.WEBUI_ADDRESS?.trim();
  return fromEnv || DEFAULT_BIND_ADDRESS;
}

/**
 * Hostname/IP for the reverse proxy HTTP server (e.g. port 30002).
 * Env: `REVERSE_PROXY_ADDRESS` — defaults to `127.0.0.1` (localhost only).
 */
export function resolveReverseProxyBindAddress(): string {
  const fromEnv = process.env.REVERSE_PROXY_ADDRESS?.trim();
  return fromEnv || DEFAULT_BIND_ADDRESS;
}

/**
 * Hostname/IP for the MCP HTTP server (e.g. port 30001).
 * Env: `MCP_ADDRESS` — when set, overrides user config bind host (Docker e2e uses `0.0.0.0`).
 * Otherwise falls back to `fallback` (typically user config `mcpHost`) or `127.0.0.1`.
 */
export function resolveMcpBindAddress(fallback?: string): string {
  const fromEnv = process.env.MCP_ADDRESS?.trim();
  if (fromEnv) {
    return fromEnv;
  }
  const fb = fallback?.trim();
  return fb || DEFAULT_BIND_ADDRESS;
}

/**
 * Hostname used in MCP `url` returned to clients when bound to all interfaces.
 */
export function resolveMcpAdvertisedHost(bindAddress: string): string {
  return resolveReverseProxyAdvertisedHost(bindAddress);
}

/**
 * Hostname used in `reverseProxyUrl` returned to clients.
 * When binding `0.0.0.0` / `::`, clients still reach the service via loopback.
 */
export function resolveReverseProxyAdvertisedHost(bindAddress: string): string {
  if (bindAddress === "0.0.0.0" || bindAddress === "::") {
    return DEFAULT_BIND_ADDRESS;
  }
  return bindAddress;
}
