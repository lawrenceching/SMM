import { Path } from "@core/path";
import {
  beginRenameFilesTaskV2,
  addRenameFileToTaskV2,
  endRenameFilesTaskV2,
  getRenameTask,
} from "@/tools/renameFilesToolV2";
import type { RenameFilesPlan } from "@core/types/RenameFilesPlan";
import type { McpToolResponse } from "./mcpToolBase";

export interface BeginRenameTaskParams {
  mediaFolderPath: string;
}

export interface AddRenameFileParams {
  taskId: string;
  from: string;
  to: string;
}

export interface EndRenameTaskParams {
  taskId: string;
}

/**
 * Begin a batch rename task for a media folder.
 * Returns a task ID that must be used for subsequent operations.
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
