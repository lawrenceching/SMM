import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { mcpTools } from "@/tools";

/**
 * Register the get-media-metadata tool with the MCP server.
 */
export function registerGetMediaMetadataTool(server: McpServer): void {
  const tool = mcpTools.getMediaMetadata();
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
