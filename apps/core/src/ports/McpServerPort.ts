export type McpServerStatus = "running" | "stopped" | "error";

export interface McpServerState {
  status: McpServerStatus;
  host?: string;
  port?: number;
  /** Full MCP client URL (includes /mcp path). */
  url?: string;
  error?: string;
}

export interface McpServerStartOptions {
  hostname: string;
  port: number;
}

/**
 * Host-specific MCP HTTP runtime. Core owns config persistence; the port
 * only starts/stops the listener and reports runtime state.
 */
export interface McpServerPort {
  start(options: McpServerStartOptions): Promise<void>;
  stop(): Promise<void>;
  getState(): McpServerState;
}
