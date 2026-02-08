import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { tmdbGetTvShowMcpTool } from "@/tools/tmdbGetTvShow";

/**
 * Register the tmdb-get-tv-show tool with the MCP server.
 * Note: This is async because tool descriptions are loaded via i18n.
 */
export async function registerTmdbGetTvShowTool(server: McpServer): Promise<void> {
  const tool = await tmdbGetTvShowMcpTool();
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
