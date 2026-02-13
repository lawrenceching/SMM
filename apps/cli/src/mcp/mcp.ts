import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import {
  registerGetMediaFoldersTool,
} from "./tools/getMediaFoldersTool";
import {
  registerIsFolderExistTool,
} from "./tools/isFolderExistTool";
import {
  registerListFilesTool,
} from "./tools/listFilesTool";
import {
  registerGetApplicationContextTool,
} from "./tools/getApplicationContextTool";
import {
  registerRenameFolderTool,
} from "./tools/renameFolderTool";
import {
  registerBeginRenameTaskTool as registerBeginRenameEpisodeVideoFileTaskTool,
  registerAddRenameFileTool as registerAddRenameEpisodeVideoFileTool,
  registerEndRenameTaskTool as registerEndRenameEpisodeVideoTaskTool,
} from "./tools/beginRenameTaskTool";
import {
  registerBeginRecognizeTaskTool,
  registerAddRecognizedFileTool,
  registerEndRecognizeTaskTool,
} from "./tools/beginRecognizeTaskTool";
import { registerGetEpisodesTool } from "./tools/getEpisodesTool";
import {
  registerGetEpisodeTool,
} from "./tools/getEpisodeTool";
import {
  registerHowToRenameEpisodeVideoFilesTool,
} from "./tools/howToRenameEpisodeVideoFilesTool";
import {
  registerReadmeTool,
} from "./tools/readmeTool";
import {
  registerHowToRecognizeEpisodeVideoFilesTool,
} from "./tools/howToRecognizeEpisodeVideoFilesTool";
import {
  registerTmdbSearchTool,
} from "./tools/tmdbSearchTool";
import {
  registerTmdbGetMovieTool,
} from "./tools/tmdbGetMovieTool";
import {
  registerTmdbGetTvShowTool,
} from "./tools/tmdbGetTvShowTool";
import { registerGetMediaMetadataTool } from "./tools";

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
        name: "Simple Media Manager (SMM)",
        version: "1.0.0",
        description: "Simple Media Manager (SMM) exposes tools to query media from TMDB and manage media folder in SMM ",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    await registerGetApplicationContextTool(server);
    await registerGetMediaFoldersTool(server);
    await registerIsFolderExistTool(server);
    await registerListFilesTool(server);

    // Media Metadata is too large for AI to handle
    // I'm going to break it down into smaller tools
    // Therefore the media metadata tools are disabled for now
    await registerGetMediaMetadataTool(server);
    // registerWriteMediaMetadataTool(server);
    // registerDeleteMediaMetadataTool(server);

    await registerReadmeTool(server);
    await registerHowToRenameEpisodeVideoFilesTool(server);
    await registerHowToRecognizeEpisodeVideoFilesTool(server);


    await registerRenameFolderTool(server);

    await registerBeginRenameEpisodeVideoFileTaskTool(server);
    await registerAddRenameEpisodeVideoFileTool(server);
    await registerEndRenameEpisodeVideoTaskTool(server);

    await registerBeginRecognizeTaskTool(server);
    await registerAddRecognizedFileTool(server);
    await registerEndRecognizeTaskTool(server);

    await registerGetEpisodeTool(server);
    await registerGetEpisodesTool(server);
    
    await registerTmdbSearchTool(server);
    await registerTmdbGetMovieTool(server);
    await registerTmdbGetTvShowTool(server);


    const transport = new WebStandardStreamableHTTPServerTransport({
      // sessionIdGenerator: () => crypto.randomUUID(),
    });

    await server.connect(transport);

    return (req: Request) => transport.handleRequest(req);
  })();
  return handlerPromise;
}
