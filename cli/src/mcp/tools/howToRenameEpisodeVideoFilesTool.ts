import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { mcpTools } from "@/tools";

/**
 * Register the how-to-rename-episode-video-files tool with the MCP server.
 * Note: This is async because tool descriptions are loaded via i18n.
 */
export async function registerHowToRenameEpisodeVideoFilesTool(server: McpServer): Promise<void> {
  const tool = await mcpTools.howToRenameEpisodeVideoFiles();
  server.registerTool(
    tool.toolName,
    {
      description: tool.description,
      inputSchema: tool.inputSchema,
      outputSchema: tool.outputSchema,
    },
    async () => {
      return await tool.execute({});
    }
  );
}
