import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { mcpTools } from "@/tools";

/**
 * Register the is-folder-exist tool with the MCP server.
 * Note: This is async because tool descriptions are loaded via i18n.
 */
export async function registerIsFolderExistTool(server: McpServer): Promise<void> {
  const tool = await mcpTools.isFolderExist();
  server.registerTool(
    tool.toolName,
    {
      description: tool.description,
      inputSchema: tool.inputSchema,
      outputSchema: tool.outputSchema,
    },
    async (args: { path: string }) => {
      return await tool.execute(args);
    }
  );
}
