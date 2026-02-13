import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { mcpTools } from "@/tools";

/**
 * Register the get-media-folders tool with the MCP server.
 * Note: This is async because tool descriptions are loaded via i18n.
 */
export async function registerGetMediaFoldersTool(server: McpServer): Promise<void> {
  const tool = await mcpTools.getMediaFolders();
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
