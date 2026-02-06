import { Path } from "@core/path";
import {
  beginRecognizeTask,
  addRecognizedMediaFile,
  endRecognizeTask,
  getTask,
} from "@/tools/recognizeMediaFilesTool";
import type { RecognizedFile } from "@core/types/RecognizeMediaFilePlan";
import type { McpToolResponse } from "./mcpToolBase";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createBeginRecognizeTaskTool, createAddRecognizedMediaFileTool, createEndRecognizeTaskTool } from "@/tools/recognizeMediaFilesTask";

export interface BeginRecognizeTaskParams {
  /** Path to the media folder for recognition task */
  mediaFolderPath: string;
}

export interface AddRecognizedFileParams {
  /** ID of the existing recognition task */
  taskId: string;
  /** Season number for the recognized file */
  season: number;
  /** Episode number for the recognized file */
  episode: number;
  /** File path of the recognized media file */
  path: string;
}

export interface EndRecognizeTaskParams {
  /** ID of the recognition task to finalize and execute */
  taskId: string;
}

/**
 * Begin a media file recognition task for a media folder.
 * Returns a task ID that must be used for subsequent operations.
 *
 * @param params - Tool parameters containing media folder path
 * @param params.mediaFolderPath - Path to the media folder for recognition
 * @returns Promise resolving to MCP tool response with task ID or error
 *
 * This creates a new recognition task that can accept multiple recognized files
 * before being finalized. Use the returned taskId with add-recognized-file and end-recognize-task.
 */
export async function handleBeginRecognizeTask(params: BeginRecognizeTaskParams): Promise<McpToolResponse> {
  const { mediaFolderPath } = params;

  if (!mediaFolderPath || typeof mediaFolderPath !== "string" || mediaFolderPath.trim() === "") {
    return {
      content: [{ type: "text" as const, text: "Invalid path: mediaFolderPath must be a non-empty string" }],
      isError: true,
    };
  }

  try {
    const folderPathInPosix = Path.posix(mediaFolderPath);
    const taskId = await beginRecognizeTask(folderPathInPosix);

    return {
      content: [{ type: "text" as const, text: JSON.stringify({ success: true, taskId, mediaFolderPath: folderPathInPosix }) }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text" as const, text: `Error starting recognize task: ${message}` }],
      isError: true,
    };
  }
}

/**
 * Add a recognized file to an existing recognition task.
 *
 * @param params - Tool parameters containing task ID and file information
 * @param params.taskId - ID of the existing recognition task
 * @param params.season - Season number for the recognized file
 * @param params.episode - Episode number for the recognized file
 * @param params.path - File path of the recognized media file
 * @returns Promise resolving to MCP tool response with success confirmation or error
 *
 * This adds a single recognized file to an existing batch recognition task.
 * Multiple files can be added to the same task before finalization.
 */
export async function handleAddRecognizedFile(params: AddRecognizedFileParams): Promise<McpToolResponse> {
  const { taskId, season, episode, path: filePath } = params;

  if (!taskId || typeof taskId !== "string") {
    return {
      content: [{ type: "text" as const, text: "Invalid taskId: must be a non-empty string" }],
      isError: true,
    };
  }

  if (season === undefined || typeof season !== "number" || season < 0) {
    return {
      content: [{ type: "text" as const, text: "Invalid season: must be a non-negative number" }],
      isError: true,
    };
  }

  if (episode === undefined || typeof episode !== "number" || episode < 0) {
    return {
      content: [{ type: "text" as const, text: "Invalid episode: must be a non-negative number" }],
      isError: true,
    };
  }

  if (!filePath || typeof filePath !== "string") {
    return {
      content: [{ type: "text" as const, text: "Invalid path: must be a non-empty string" }],
      isError: true,
    };
  }

  try {
    const recognizedFile: RecognizedFile = {
      season,
      episode,
      path: Path.posix(filePath),
    };

    await addRecognizedMediaFile(taskId, recognizedFile);

    return {
      content: [{ type: "text" as const, text: JSON.stringify({ success: true, taskId }) }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text" as const, text: `Error adding recognized file: ${message}` }],
      isError: true,
    };
  }
}

/**
 * End a recognition task and finalize the plan.
 *
 * @param params - Tool parameters containing task ID
 * @param params.taskId - ID of recognition task to finalize and execute
 * @returns Promise resolving to MCP tool response with success confirmation or error
 *
 * This finalizes a batch recognition task and creates the recognition plan.
 * The task must contain at least one recognized file to be successfully ended.
 */
export async function handleEndRecognizeTask(params: EndRecognizeTaskParams): Promise<McpToolResponse> {
  const { taskId } = params;

  if (!taskId || typeof taskId !== "string") {
    return {
      content: [{ type: "text" as const, text: "Invalid taskId: must be a non-empty string" }],
      isError: true,
    };
  }

  try {
    // Check if task exists and has files
    const task = await getTask(taskId);

    if (!task) {
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ success: false, error: "Task not found" }) }],
      };
    }

    if (task.files.length === 0) {
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ success: false, error: "No recognized files in task" }) }],
      };
    }

    await endRecognizeTask(taskId);

    return {
      content: [{ type: "text" as const, text: JSON.stringify({ success: true, taskId, fileCount: task.files.length }) }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text" as const, text: `Error ending recognize task: ${message}` }],
      isError: true,
    };
  }
}

/**
 * Register the begin-recognize-task tool with the MCP server.
 */
export async function registerBeginRecognizeTaskTool(server: McpServer): Promise<void> {
  const tool = await createBeginRecognizeTaskTool('mcp');

  server.registerTool(
    "begin-recognize-task",
    {
      description: tool.description,
      inputSchema: {
        mediaFolderPath: z.string().describe("The absolute path of the media folder"),
      },
    } as any,
    async (args: any) => {
      return handleBeginRecognizeTask(args);
    }
  );
}

/**
 * Register the add-recognized-file tool with the MCP server.
 */
export async function registerAddRecognizedFileTool(server: McpServer): Promise<void> {
  const tool = await createAddRecognizedMediaFileTool('mcp');

  server.registerTool(
    "add-recognized-file",
    {
      description: tool.description,
      inputSchema: {
        taskId: z.string().describe("The task ID from begin-recognize-task"),
        season: z.number().describe("The season number of the episode"),
        episode: z.number().describe("The episode number"),
        path: z.string().describe("The absolute path of the media file"),
      },
    } as any,
    async (args: any) => {
      return handleAddRecognizedFile(args);
    }
  );
}

/**
 * Register the end-recognize-task tool with the MCP server.
 */
export async function registerEndRecognizeTaskTool(server: McpServer): Promise<void> {
  const tool = await createEndRecognizeTaskTool('mcp');

  server.registerTool(
    "end-recognize-task",
    {
      description: tool.description,
      inputSchema: {
        taskId: z.string().describe("The task ID from begin-recognize-task"),
      },
    } as any,
    async (args: any) => {
      return handleEndRecognizeTask(args);
    }
  );
}
