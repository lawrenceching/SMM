import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { mcpTools } from "@/tools";

/**
 * Register the get-media-folders tool with the MCP server.
 */
export function registerGetMediaFoldersTool(server: McpServer): void {
  const tool = mcpTools.getMediaFolders();
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
