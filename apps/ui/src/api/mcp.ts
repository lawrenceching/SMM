/**
 * Mirrors the McpServerState from apps/cli/src/mcp/mcpServerManager.ts
 */
export interface McpServerState {
  status: "running" | "stopped" | "error";
  host?: string;
  port?: number;
  error?: string;
}

/**
 * Starts the MCP server on the backend.
 * Optionally overrides host/port (falls back to user config values otherwise).
 * The promise resolves when the server is fully started or rejects on failure.
 */
export async function startMcpServer(options?: {
  host?: string;
  port?: number;
}): Promise<McpServerState> {
  const resp = await fetch("/api/mcp/start", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(options ?? {}),
  });
  const data: McpServerState = await resp.json();
  if (!resp.ok) {
    throw new Error(data.error || "Failed to start MCP server");
  }
  return data;
}

/**
 * Stops the MCP server on the backend.
 */
export async function stopMcpServer(): Promise<McpServerState> {
  const resp = await fetch("/api/mcp/stop", { method: "PUT" });
  const data: McpServerState = await resp.json();
  if (!resp.ok) {
    throw new Error(data.error || "Failed to stop MCP server");
  }
  return data;
}

/**
 * Returns the current MCP server runtime state as tracked by the backend.
 */
export async function getMcpServerStatus(): Promise<McpServerState> {
  const resp = await fetch("/api/mcp/status");
  return resp.json() as Promise<McpServerState>;
}
