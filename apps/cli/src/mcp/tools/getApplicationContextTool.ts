import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { mcpTools } from "@/tools";

/**
 * Register the get-application-context tool with the MCP server.
 * Note: This is async because tool descriptions are loaded via i18n.
 */
export async function registerGetApplicationContextTool(server: McpServer): Promise<void> {
  const tool = await mcpTools.getApplicationContext();
  server.registerTool(
    tool.toolName,
    {
      description: tool.description,
      inputSchema: tool.inputSchema,
      outputSchema: tool.outputSchema,
    },
    async () => {
      return await tool.execute({ path: '' });
    }
  );
}
