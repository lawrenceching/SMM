import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { tmdbSearchMcpTool } from "@/tools/tmdbSearch";

/**
 * Register the tmdb-search tool with the MCP server.
 * Note: This is async because tool descriptions are loaded via i18n.
 */
export async function registerTmdbSearchTool(server: McpServer): Promise<void> {
  const tool = await tmdbSearchMcpTool();
  server.registerTool(
    tool.toolName,
    {
      description: tool.description,
      inputSchema: tool.inputSchema,
      outputSchema: tool.outputSchema,
    },
    async (args: any) => {
      return await tool.execute(args);
    }
  );
}
