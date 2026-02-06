import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { mcpTools } from "@/tools";

/**
 * Register the rename-folder tool with the MCP server.
 * Note: This is async because tool descriptions are loaded via i18n.
 */
export async function registerRenameFolderTool(server: McpServer): Promise<void> {
  const tool = await mcpTools.renameFolder();
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
