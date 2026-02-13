import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { tmdbGetMovieMcpTool } from "@/tools/tmdbGetMovie";

/**
 * Register the tmdb-get-movie tool with the MCP server.
 * Note: This is async because tool descriptions are loaded via i18n.
 */
export async function registerTmdbGetMovieTool(server: McpServer): Promise<void> {
  const tool = await tmdbGetMovieMcpTool();
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
