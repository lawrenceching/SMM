export type McpServerStatus = "running" | "stopped" | "error";

export interface McpServerState {
  status: McpServerStatus;
  host?: string;
  port?: number;
  /** Full URL for external MCP clients (includes path). */
  url?: string;
  error?: string;
}

export interface StartMcpOptions {
  hostname?: string;
  port?: number;
}

/**
 * Runtime-specific MCP server lifecycle. Injected by `apps/cli` (Bun
 * separate port) or `apps/ohos` (gate `/mcp` on the main HTTP port).
 */
export interface McpLifecycleManager {
  start(options?: StartMcpOptions): Promise<void>;
  stop(): Promise<void>;
  getState(): McpServerState;
}
