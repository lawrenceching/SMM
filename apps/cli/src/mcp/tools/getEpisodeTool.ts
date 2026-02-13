import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { mcpTools } from "@/tools";

export async function registerGetEpisodeTool(server: McpServer): Promise<void> {
  const tool = await mcpTools.getEpisode();
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
