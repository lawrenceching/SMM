import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { handleGetMediaFolders } from "./getMediaFoldersTool";

const server = new McpServer(
  {
    name: "smm",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.registerTool(
  "get-media-folders",
  {
    description: "Returns the SMM-managed media folder paths from user config (userConfig.folders).",
  },
  async () => {
    return handleGetMediaFolders();
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
process.stderr.write("SMM MCP server running on stdio\n");
