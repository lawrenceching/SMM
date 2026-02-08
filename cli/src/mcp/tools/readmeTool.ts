import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { mcpTools } from "@/tools";

/**
 * Register the readme tool with the MCP server.
 */
export async function registerReadmeTool(server: McpServer): Promise<void> {
  const tool = await mcpTools.readme();
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
