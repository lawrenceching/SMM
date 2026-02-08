import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { mcpTools } from "@/tools";

/**
 * Register the how-to-recognize-episode-video-files tool with the MCP server.
 * Note: This is async because tool descriptions are loaded via i18n.
 */
export async function registerHowToRecognizeEpisodeVideoFilesTool(server: McpServer): Promise<void> {
  const tool = await mcpTools.howToRecognizeEpisodeVideoFiles();
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
