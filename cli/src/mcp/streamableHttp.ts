import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { handleGetMediaFolders } from "./getMediaFoldersTool";
import { handleIsFolderExist } from "./tools/isFolderExistTool";
import { handleListFiles } from "./tools/listFilesTool";
import { handleGetMediaMetadata } from "./tools/getMediaMetadataTool";
import { handleWriteMediaMetadata } from "./tools/writeMediaMetadataTool";
import { handleDeleteMediaMetadata } from "./tools/deleteMediaMetadataTool";
import { handleGetEpisodes } from "./tools/getEpisodesTool";
import { handleGetApplicationContext } from "./tools/getApplicationContextTool";
import { handleRenameFolder } from "./tools/renameFolderTool";
import {
  handleBeginRenameTask,
  handleAddRenameFile,
  handleEndRenameTask,
} from "./tools/beginRenameTaskTool";
import {
  handleBeginRecognizeTask,
  handleAddRecognizedFile,
  handleEndRecognizeTask,
} from "./tools/beginRecognizeTaskTool";

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

    // Existing tool: get-media-folders
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

    // File operation tools
    server.registerTool(
      "is-folder-exist",
      {
        description: "Check if a folder exists at the specified path. Accepts paths in POSIX or Windows format.",
        inputSchema: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: "The absolute path of the folder to check",
            },
          },
          required: ["path"],
        },
      } as any,
      async (args: any) => {
        return handleIsFolderExist(args);
      }
    );

    server.registerTool(
      "list-files",
      {
        description: "List all files in a media folder recursively. Accepts paths in POSIX or Windows format. Returns file paths in POSIX format.",
        inputSchema: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: "The absolute path of the folder to list files from",
            },
          },
          required: ["path"],
        },
      } as any,
      async (args: any) => {
        return handleListFiles(args);
      }
    );

    // Media metadata tools
    server.registerTool(
      "get-media-metadata",
      {
        description: "Get cached media metadata for a folder. Returns metadata including type, TMDB ID, name, and seasons.",
        inputSchema: {
          type: "object",
          properties: {
            mediaFolderPath: {
              type: "string",
              description: "The absolute path of the media folder",
            },
          },
          required: ["mediaFolderPath"],
        },
      } as any,
      async (args: any) => {
        return handleGetMediaMetadata(args);
      }
    );

    server.registerTool(
      "write-media-metadata",
      {
        description: "Write media metadata to the cache. Requires metadata object with mediaFolderPath.",
        inputSchema: {
          type: "object",
          properties: {
            metadata: {
              type: "object",
              description: "The media metadata object to write",
              properties: {
                mediaFolderPath: { type: "string" },
                mediaName: { type: "string" },
                type: { type: "string" },
                tmdbTvShow: { type: "object" },
              },
              required: ["mediaFolderPath"],
            },
          },
          required: ["metadata"],
        },
      } as any,
      async (args: any) => {
        return handleWriteMediaMetadata(args);
      }
    );

    server.registerTool(
      "delete-media-metadata",
      {
        description: "Delete cached media metadata for a folder.",
        inputSchema: {
          type: "object",
          properties: {
            mediaFolderPath: {
              type: "string",
              description: "The absolute path of the media folder",
            },
          },
          required: ["mediaFolderPath"],
        },
      } as any,
      async (args: any) => {
        return handleDeleteMediaMetadata(args);
      }
    );

    // Episode and context tools
    server.registerTool(
      "get-episodes",
      {
        description: "Get all episodes for a TV show media folder. Returns a flat array of all episodes across all seasons.",
        inputSchema: {
          type: "object",
          properties: {
            mediaFolderPath: {
              type: "string",
              description: "The absolute path of the TV show media folder",
            },
          },
          required: ["mediaFolderPath"],
        },
      } as any,
      async (args: any) => {
        return handleGetEpisodes(args);
      }
    );

    server.registerTool(
      "get-application-context",
      {
        description: "Get application context including configured media folders and settings.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      } as any,
      async () => {
        return handleGetApplicationContext();
      }
    );

    // Rename tools
    server.registerTool(
      "rename-folder",
      {
        description: "Rename a media folder. This is a destructive operation - the folder will be renamed on disk and metadata cache will be updated.",
        inputSchema: {
          type: "object",
          properties: {
            from: {
              type: "string",
              description: "The current absolute path of the folder to rename",
            },
            to: {
              type: "string",
              description: "The new absolute path for the folder",
            },
          },
          required: ["from", "to"],
        },
      } as any,
      async (args: any) => {
        return handleRenameFolder(args);
      }
    );

    server.registerTool(
      "begin-rename-task",
      {
        description: "Begin a batch rename task for a media folder. Returns a task ID for use with add-rename-file and end-rename-task.",
        inputSchema: {
          type: "object",
          properties: {
            mediaFolderPath: {
              type: "string",
              description: "The absolute path of the media folder",
            },
          },
          required: ["mediaFolderPath"],
        },
      } as any,
      async (args: any) => {
        return handleBeginRenameTask(args);
      }
    );

    server.registerTool(
      "add-rename-file",
      {
        description: "Add a file rename operation to an existing rename task.",
        inputSchema: {
          type: "object",
          properties: {
            taskId: {
              type: "string",
              description: "The task ID from begin-rename-task",
            },
            from: {
              type: "string",
              description: "The current absolute path of the file to rename",
            },
            to: {
              type: "string",
              description: "The new absolute path for the file",
            },
          },
          required: ["taskId", "from", "to"],
        },
      } as any,
      async (args: any) => {
        return handleAddRenameFile(args);
      }
    );

    server.registerTool(
      "end-rename-task",
      {
        description: "End a batch rename task and finalize the plan. The task must have at least one file.",
        inputSchema: {
          type: "object",
          properties: {
            taskId: {
              type: "string",
              description: "The task ID from begin-rename-task",
            },
          },
          required: ["taskId"],
        },
      } as any,
      async (args: any) => {
        return handleEndRenameTask(args);
      }
    );

    // Recognize tools
    server.registerTool(
      "begin-recognize-task",
      {
        description: "Begin a media file recognition task for a media folder. Returns a task ID for use with add-recognized-file and end-recognize-task.",
        inputSchema: {
          type: "object",
          properties: {
            mediaFolderPath: {
              type: "string",
              description: "The absolute path of the media folder",
            },
          },
          required: ["mediaFolderPath"],
        },
      } as any,
      async (args: any) => {
        return handleBeginRecognizeTask(args);
      }
    );

    server.registerTool(
      "add-recognized-file",
      {
        description: "Add a recognized media file to an existing recognition task.",
        inputSchema: {
          type: "object",
          properties: {
            taskId: {
              type: "string",
              description: "The task ID from begin-recognize-task",
            },
            season: {
              type: "number",
              description: "The season number of the episode",
            },
            episode: {
              type: "number",
              description: "The episode number",
            },
            path: {
              type: "string",
              description: "The absolute path of the media file",
            },
          },
          required: ["taskId", "season", "episode", "path"],
        },
      } as any,
      async (args: any) => {
        return handleAddRecognizedFile(args);
      }
    );

    server.registerTool(
      "end-recognize-task",
      {
        description: "End a recognition task and finalize the plan. The task must have at least one recognized file.",
        inputSchema: {
          type: "object",
          properties: {
            taskId: {
              type: "string",
              description: "The task ID from begin-recognize-task",
            },
          },
          required: ["taskId"],
        },
      } as any,
      async (args: any) => {
        return handleEndRecognizeTask(args);
      }
    );

    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    await server.connect(transport);

    return (req: Request) => transport.handleRequest(req);
  })();
  return handlerPromise;
}
