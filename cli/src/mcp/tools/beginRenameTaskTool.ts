import { Path } from "@core/path";
import {
  beginRenameFilesTaskV2,
  addRenameFileToTaskV2,
  endRenameFilesTaskV2,
  getRenameTask,
} from "@/tools/renameFilesToolV2";
import type { RenameFilesPlan } from "@core/types/RenameFilesPlan";
import type { McpToolResponse } from "./mcpToolBase";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export interface BeginRenameTaskParams {
  /** Path to the media folder for the batch rename operation */
  mediaFolderPath: string;
}

export interface AddRenameFileParams {
  /** ID of the existing rename task */
  taskId: string;
  /** Current file path to be renamed */
  from: string;
  /** New file path after rename */
  to: string;
}

export interface EndRenameTaskParams {
  /** ID of the rename task to finalize and execute */
  taskId: string;
}

/**
 * Begin a batch rename task for a media folder.
 * Returns a task ID that must be used for subsequent operations.
 *
 * @param params - Tool parameters containing media folder path
 * @param params.mediaFolderPath - Path to the media folder for batch rename
 * @returns Promise resolving to MCP tool response with task ID or error
 *
 * This creates a new rename task that can accept multiple file rename operations
 * before being finalized. Use the returned taskId with add-rename-file and end-rename-task.
 */
export async function handleBeginRenameTask(params: BeginRenameTaskParams): Promise<McpToolResponse> {
  const { mediaFolderPath } = params;

  if (!mediaFolderPath || typeof mediaFolderPath !== "string" || mediaFolderPath.trim() === "") {
    return {
      content: [{ type: "text" as const, text: "Invalid path: mediaFolderPath must be a non-empty string" }],
      isError: true,
    };
  }

  try {
    const folderPathInPosix = Path.posix(mediaFolderPath);
    const taskId = await beginRenameFilesTaskV2(folderPathInPosix);

    return {
      content: [{ type: "text" as const, text: JSON.stringify({ success: true, taskId, mediaFolderPath: folderPathInPosix }) }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text" as const, text: `Error starting rename task: ${message}` }],
      isError: true,
    };
  }
}

/**
 * Add a file rename operation to an existing task.
 *
 * @param params - Tool parameters containing task ID and file paths
 * @param params.taskId - ID of the existing rename task
 * @param params.from - Current file path to be renamed
 * @param params.to - New file path after rename
 * @returns Promise resolving to MCP tool response with success confirmation or error
 *
 * This adds a single file rename operation to an existing batch rename task.
 * Multiple files can be added to the same task before finalization.
 */
export async function handleAddRenameFile(params: AddRenameFileParams): Promise<McpToolResponse> {
  const { taskId, from, to } = params;

  if (!taskId || typeof taskId !== "string") {
    return {
      content: [{ type: "text" as const, text: "Invalid taskId: must be a non-empty string" }],
      isError: true,
    };
  }

  if (!from || typeof from !== "string") {
    return {
      content: [{ type: "text" as const, text: "Invalid path: 'from' must be a non-empty string" }],
      isError: true,
    };
  }

  if (!to || typeof to !== "string") {
    return {
      content: [{ type: "text" as const, text: "Invalid path: 'to' must be a non-empty string" }],
      isError: true,
    };
  }

  try {
    await addRenameFileToTaskV2(taskId, Path.posix(from), Path.posix(to));

    return {
      content: [{ type: "text" as const, text: JSON.stringify({ success: true, taskId }) }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text" as const, text: `Error adding rename file: ${message}` }],
      isError: true,
    };
  }
}

/**
 * End a batch rename task and finalize the plan.
 *
 * @param params - Tool parameters containing task ID
 * @param params.taskId - ID of the rename task to finalize and execute
 * @returns Promise resolving to MCP tool response with success confirmation or error
 *
 * This finalizes a batch rename task and executes all queued file rename operations.
 * The task must contain at least one file rename operation to be successfully ended.
 */
export async function handleEndRenameTask(params: EndRenameTaskParams): Promise<McpToolResponse> {
  const { taskId } = params;

  if (!taskId || typeof taskId !== "string") {
    return {
      content: [{ type: "text" as const, text: "Invalid taskId: must be a non-empty string" }],
      isError: true,
    };
  }

  try {
    // Check if task exists and has files
    const task = await getRenameTask(taskId);

    if (!task) {
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ success: false, error: "Task not found" }) }],
      };
    }

    if (task.files.length === 0) {
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ success: false, error: "No files in task" }) }],
      };
    }

    await endRenameFilesTaskV2(taskId);

    return {
      content: [{ type: "text" as const, text: JSON.stringify({ success: true, taskId, fileCount: task.files.length }) }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text" as const, text: `Error ending rename task: ${message}` }],
      isError: true,
    };
  }
}

/**
 * Register the begin-rename-task tool with the MCP server.
 */
export function registerBeginRenameTaskTool(server: McpServer): void {
  server.registerTool(
    "begin-rename-task",
    {
      description: "Begin a batch rename task for a media folder. Returns a task ID for use with add-rename-file and end-rename-task.",
      inputSchema: {
        mediaFolderPath: z.string().describe("The absolute path of the media folder"),
      },
    } as any,
    async (args: any) => {
      return handleBeginRenameTask(args);
    }
  );
}

/**
 * Register the add-rename-file tool with the MCP server.
 */
export function registerAddRenameFileTool(server: McpServer): void {
  server.registerTool(
    "add-rename-file",
    {
      description: "Add a file rename operation to an existing rename task.",
      inputSchema: {
        taskId: z.string().describe("The task ID from begin-rename-task"),
        from: z.string().describe("The current absolute path of the file to rename"),
        to: z.string().describe("The new absolute path for the file"),
      },
    } as any,
    async (args: any) => {
      return handleAddRenameFile(args);
    }
  );
}

/**
 * Register the end-rename-task tool with the MCP server.
 */
export function registerEndRenameTaskTool(server: McpServer): void {
  server.registerTool(
    "end-rename-task",
    {
      description: "End a batch rename task and finalize the plan. The task must have at least one file.",
      inputSchema: {
        taskId: z.string().describe("The task ID from begin-rename-task"),
      },
    } as any,
    async (args: any) => {
      return handleEndRenameTask(args);
    }
  );
}
