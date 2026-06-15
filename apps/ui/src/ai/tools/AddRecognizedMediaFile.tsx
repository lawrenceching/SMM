import { makeAssistantTool, tool } from "@assistant-ui/react"
import { z } from 'zod'
import { addRecognizedFileToPlan } from "../planStore"

/**
 * Frontend AI tool: `add-recognized-media-file`.
 *
 * Appends a `{ season, episode, path }` entry to a recognize-media-file
 * plan created by `beginRecognizeTask`. The plan lives in IndexedDB
 * (`apps/ui/src/ai/planStore.ts`).
 *
 * Mirrors the backend `createAddRecognizedMediaFileTool` factory in
 * `apps/cli/src/tools/recognizeMediaFilesTask.ts`, which appends to
 * the same plan file on disk.
 */
const addRecognizedMediaFile = tool({
  description:
    "Add a recognized media file to a recognition task. " +
    "This tool adds a single video file to an existing task created " +
    "by beginRecognizeTask. " +
    "Provide the task ID, season number, episode number, and file " +
    "path.",
  parameters: z.object({
    taskId: z
      .string()
      .describe("The task ID returned from beginRecognizeTask."),
    season: z.number().describe("The season number of the episode."),
    episode: z.number().describe("The episode number."),
    path: z
      .string()
      .describe(
        "The absolute path of the media file " +
          "(POSIX or Windows format).",
      ),
  }),
  execute: async ({ taskId, season, episode, path: filePath }) => {
    if (!taskId || typeof taskId !== "string" || taskId.trim() === "") {
      return { error: "Invalid taskId: must be a non-empty string" }
    }
    if (!filePath || typeof filePath !== "string" || filePath.trim() === "") {
      return { error: "Invalid path: 'path' must be a non-empty string" }
    }

    try {
      const updated = await addRecognizedFileToPlan(taskId, {
        season,
        episode,
        path: filePath,
      })
      if (updated === null) {
        return { error: `Error Reason: Task with id "${taskId}" not found` }
      }
      return { error: undefined }
    } catch (error) {
      return {
        error: `Error Reason: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      }
    }
  },
})

export const AddRecognizedMediaFileTool = makeAssistantTool({
  ...addRecognizedMediaFile,
  toolName: "add-recognized-media-file",
})
