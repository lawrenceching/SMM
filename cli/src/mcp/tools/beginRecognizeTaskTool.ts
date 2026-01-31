import { Path } from "@core/path";
import {
  beginRecognizeTask,
  addRecognizedMediaFile,
  endRecognizeTask,
  getTask,
} from "@/tools/recognizeMediaFilesTool";
import type { RecognizedFile } from "@core/types/RecognizeMediaFilePlan";
import type { McpToolResponse } from "./mcpToolBase";

export interface BeginRecognizeTaskParams {
  mediaFolderPath: string;
}

export interface AddRecognizedFileParams {
  taskId: string;
  season: number;
  episode: number;
  path: string;
}

export interface EndRecognizeTaskParams {
  taskId: string;
}

/**
 * Begin a media file recognition task for a media folder.
 * Returns a task ID that must be used for subsequent operations.
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
 * Add a recognized media file to an existing task.
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
