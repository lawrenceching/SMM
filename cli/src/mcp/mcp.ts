import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { registerGetMediaFoldersTool } from "./getMediaFoldersTool";
import {
  registerIsFolderExistTool,
} from "./tools/isFolderExistTool";
import {
  registerListFilesTool,
} from "./tools/listFilesTool";
import {
  registerGetMediaMetadataTool,
} from "./tools/getMediaMetadataTool";
import {
  registerWriteMediaMetadataTool,
} from "./tools/writeMediaMetadataTool";
import {
  registerDeleteMediaMetadataTool,
} from "./tools/deleteMediaMetadataTool";
import {
  registerGetEpisodesTool,
} from "./tools/getEpisodesTool";
import {
  registerGetApplicationContextTool,
} from "./tools/getApplicationContextTool";
import {
  registerRenameFolderTool,
} from "./tools/renameFolderTool";
import {
  registerBeginRenameTaskTool,
  registerAddRenameFileTool,
  registerEndRenameTaskTool,
} from "./tools/beginRenameTaskTool";
import {
  registerBeginRecognizeTaskTool,
  registerAddRecognizedFileTool,
  registerEndRecognizeTaskTool,
} from "./tools/beginRecognizeTaskTool";
import { registerCalculateTool } from "./tools/calculateTool";

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

    registerCalculateTool(server);
    registerGetMediaFoldersTool(server);
    registerIsFolderExistTool(server);
    registerListFilesTool(server);
    registerGetMediaMetadataTool(server);
    registerWriteMediaMetadataTool(server);
    registerDeleteMediaMetadataTool(server);
    registerGetEpisodesTool(server);
    registerGetApplicationContextTool(server);
    registerRenameFolderTool(server);
    registerBeginRenameTaskTool(server);
    registerAddRenameFileTool(server);
    registerEndRenameTaskTool(server);
    registerBeginRecognizeTaskTool(server);
    registerAddRecognizedFileTool(server);
    registerEndRecognizeTaskTool(server);

    const transport = new WebStandardStreamableHTTPServerTransport({
      // sessionIdGenerator: () => crypto.randomUUID(),
    });

    await server.connect(transport);

    return (req: Request) => transport.handleRequest(req);
  })();
  return handlerPromise;
}
