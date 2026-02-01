import { getUserConfig } from "@/utils/config";
import type { McpToolResponse } from "./mcpToolBase";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/**
 * Get application context including configured media folders and settings.
 *
 * @returns Promise resolving to MCP tool response with application context or error
 *
 * Returns comprehensive configuration information including:
 * - AI provider selection
 * - Application language settings
 * - Configured media folders
 * - Selected rename rules
 * - TMDB API configuration
 */
export async function handleGetApplicationContext(): Promise<McpToolResponse> {
  try {
    const userConfig = await getUserConfig();

    const context = {
      selectedAI: userConfig.selectedAI,
      applicationLanguage: userConfig.applicationLanguage,
      folders: userConfig.folders ?? [],
      selectedRenameRule: userConfig.selectedRenameRule,
      tmdb: userConfig.tmdb,
    };

    return {
      content: [{ type: "text" as const, text: JSON.stringify({ success: true, context }, null, 2) }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text" as const, text: `Error getting application context: ${message}` }],
      isError: true,
    };
  }
}

/**
 * Register the get-application-context tool with the MCP server.
 */
export function registerGetApplicationContextTool(server: McpServer): void {
  server.registerTool(
    "get-application-context",
    {
      description: "Get application context including configured media folders and settings.",
    },
    async () => {
      return handleGetApplicationContext();
    }
  );
}
