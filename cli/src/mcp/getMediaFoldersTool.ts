import { getUserConfig } from "@/utils/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/**
 * MCP tool handler for get-media-folders.
 * Returns the SMM-managed media folder paths (userConfig.folders) from user config.
 * On config read failure, returns a tool error result (isError: true).
 */
export async function handleGetMediaFolders(): Promise<{
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}> {
  try {
    const userConfig = await getUserConfig();
    const folders = userConfig.folders ?? [];
    return {
      content: [{ type: "text" as const, text: JSON.stringify(folders) }],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: "text" as const, text: `Error reading config: ${message}` }],
      isError: true,
    };
  }
}

export function registerGetMediaFoldersTool(server: McpServer) {
  server.registerTool(
    "get-media-folders",
    {
      description: "Returns the SMM-managed media folder paths from user config (userConfig.folders).",
    },
    async () => {
      return handleGetMediaFolders();
    }
  );
}
