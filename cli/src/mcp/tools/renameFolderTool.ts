import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { mcpTools } from "@/tools";

/**
 * Register the rename-folder tool with the MCP server.
 */
export function registerRenameFolderTool(server: McpServer): void {
  const tool = mcpTools.renameFolder();
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
