import { getUserConfig } from "@/utils/config";
import type { McpToolResponse } from "./mcpToolBase";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { mcpTools } from "@/tools";

/**
 * Register the get-application-context tool with the MCP server.
 */
export function registerGetApplicationContextTool(server: McpServer): void {
  const tool = mcpTools.getApplicationContext();
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
