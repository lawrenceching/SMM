import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { mcpTools } from "@/tools";

/**
 * Register the is-folder-exist tool with the MCP server.
 */
export function registerIsFolderExistTool(server: McpServer): void {
  const tool = mcpTools.isFolderExist();
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
