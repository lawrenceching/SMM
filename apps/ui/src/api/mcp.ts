import { apiFetch } from '@/lib/apiFetch';

export interface McpServerState {
  status: "running" | "stopped" | "error";
  host?: string;
  port?: number;
  /** Full MCP client URL (OHOS uses main HTTP port + /mcp path). */
  url?: string;
  error?: string;
}

interface McpServerStateResponse {
  data?: McpServerState;
  error?: string | null;
}

async function parseMcpResponse(resp: Response): Promise<McpServerState> {
  if (!resp.ok) {
    throw new Error(`HTTP Layer Error: ${resp.status} ${resp.statusText}`);
  }

  const body = (await resp.json()) as McpServerStateResponse;
  if (body.error) {
    throw new Error(body.error);
  }
  if (!body.data) {
    throw new Error("Error Reason: MCP server response missing data");
  }
  if (body.data.status === "error") {
    throw new Error(body.data.error ?? body.error ?? "Error Reason: MCP server error");
  }
  return body.data;
}

/**
 * Starts the MCP server on the backend.
 * Core persists enableMcpServer / mcpHost / mcpPort in smm.json on success.
 */
export async function startMcpServer(options?: {
  host?: string;
  port?: number;
}): Promise<McpServerState> {
  const resp = await apiFetch("/api/start-mcp-server", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(options ?? {}),
  });
  return parseMcpResponse(resp);
}

/**
 * Stops the MCP server on the backend.
 * Core persists enableMcpServer: false in smm.json.
 */
export async function stopMcpServer(): Promise<McpServerState> {
  const resp = await apiFetch("/api/stop-mcp-server", {
    method: "POST",
  });
  return parseMcpResponse(resp);
}

/**
 * Returns MCP runtime state. Core may reconcile smm.json when config disagrees with runtime.
 */
export async function getMcpServerStatus(): Promise<McpServerState> {
  const resp = await apiFetch("/api/get-mcp-server-status");
  return parseMcpResponse(resp);
}
