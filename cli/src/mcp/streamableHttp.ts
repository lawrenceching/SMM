import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { handleGetMediaFolders } from "./getMediaFoldersTool";

let handlerPromise: Promise<(req: Request) => Promise<Response>> | null = null;

/**
 * Returns a request handler for MCP Streamable HTTP. Creates the MCP server and transport
 * on first call and reuses them for subsequent requests.
 */
export async function getMcpStreamableHttpHandler(): Promise<
  (req: Request) => Promise<Response>
> {
  if (handlerPromise) {
    return handlerPromise;
  }
  handlerPromise = (async () => {
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
        description:
          "Returns the SMM-managed media folder paths from user config (userConfig.folders).",
      },
      async () => {
        return handleGetMediaFolders();
      }
    );

    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: () => crypto.randomUUID(),
    });

    await server.connect(transport);

    return (req: Request) => transport.handleRequest(req);
  })();
  return handlerPromise;
}
