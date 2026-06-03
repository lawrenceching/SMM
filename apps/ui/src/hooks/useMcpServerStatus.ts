import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getMcpServerStatus, startMcpServer, stopMcpServer } from "@/api/mcp";
import type { McpServerState } from "@/api/mcp";

export const mcpServerStatusQueryKey = ["mcp", "serverStatus"] as const;

/**
 * Fetches the MCP server runtime state from the backend.
 * Used on initial load to reconcile the UI toggle with real server state.
 */
export function useMcpServerStatus() {
  return useQuery<McpServerState>({
    queryKey: mcpServerStatusQueryKey,
    queryFn: getMcpServerStatus,
    staleTime: 5_000,
    retry: false,
  });
}

/**
 * Starts the MCP server and updates the query cache with the result.
 * Returns the new state. Throws on failure so callers can handle errors.
 */
export async function doStartMcpServer(client: ReturnType<typeof useQueryClient>, options?: { host?: string; port?: number }): Promise<McpServerState> {
  const state = await startMcpServer(options);
  client.setQueryData(mcpServerStatusQueryKey, state);
  return state;
}

/**
 * Stops the MCP server and updates the query cache with "stopped".
 */
export async function doStopMcpServer(client: ReturnType<typeof useQueryClient>): Promise<McpServerState> {
  const state = await stopMcpServer();
  client.setQueryData(mcpServerStatusQueryKey, state);
  return state;
}
