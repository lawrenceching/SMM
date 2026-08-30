import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getMcpServerStatus, startMcpServer, stopMcpServer } from "@/api/mcp";
import type { McpServerState } from "@/api/mcp";
import { useRefreshUserConfig } from "@/hooks/userConfig/useRefreshUserConfig";

export const mcpServerStatusQueryKey = ["mcp", "serverStatus"] as const;

/**
 * Fetches the MCP server runtime state from the backend.
 * Used on initial load to reconcile the UI toggle with real server state.
 */
export function useMcpServerStatusQuery() {
  return useQuery<McpServerState>({
    queryKey: mcpServerStatusQueryKey,
    queryFn: getMcpServerStatus,
    staleTime: 5_000,
    retry: false,
  });
}

/** @deprecated Use {@link useMcpServerStatusQuery} */
export const useMcpServerStatus = useMcpServerStatusQuery;

function useInvalidateMcpCaches() {
  const queryClient = useQueryClient();
  const refreshUserConfig = useRefreshUserConfig();

  return async (state: McpServerState) => {
    queryClient.setQueryData(mcpServerStatusQueryKey, state);
    await refreshUserConfig();
  };
}

/**
 * Starts the MCP server. Core persists MCP fields in smm.json.
 */
export function useStartMcpServerMutation() {
  const invalidateMcpCaches = useInvalidateMcpCaches();

  return useMutation({
    mutationFn: startMcpServer,
    onSuccess: (state) => {
      void invalidateMcpCaches(state);
    },
  });
}

/**
 * Stops the MCP server. Core persists enableMcpServer: false in smm.json.
 */
export function useStopMcpServerMutation() {
  const invalidateMcpCaches = useInvalidateMcpCaches();
  const refreshUserConfig = useRefreshUserConfig();

  return useMutation({
    mutationFn: stopMcpServer,
    onSuccess: (state) => {
      void invalidateMcpCaches(state);
    },
    onError: () => {
      void refreshUserConfig();
    },
  });
}
