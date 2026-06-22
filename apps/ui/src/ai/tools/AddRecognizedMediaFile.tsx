import { makeAssistantTool, tool } from "@assistant-ui/react"
import { z } from 'zod'
import { Path } from '@core/path'
import type { RecognizeMediaFilePlan } from "@core/types/RecognizeMediaFilePlan"
import { updatePlan } from "@/api/updatePlan"
import { setPlanDraft } from "../plan/aiPlanDrafts"
import { resolveRecognizePlanDraft } from "../plan/recognizePlanService"

/**
 * Frontend AI tool: `add-recognized-media-file`.
 *
 * Appends a `{ season, episode, path }` entry to a recognize-media-file
 * plan created by `beginRecognizeTask`. The plan is persisted on the
 * backend via the unified `/api/updatePlan` endpoint; entries are
 * accumulated in the in-memory draft store between `begin` and `end`.
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
      const plan = await resolveRecognizePlanDraft(taskId)
      if (!plan) {
        return { error: `Error Reason: Task with id "${taskId.trim()}" not found` }
      }

      const files = [
        ...plan.files,
        { season, episode, path: Path.posix(filePath) },
      ]
      const resp = await updatePlan(taskId.trim(), { files })
      if (resp.error || !resp.data) {
        return { error: resp.error ?? "updatePlan failed" }
      }
      setPlanDraft(resp.data.plan as RecognizeMediaFilePlan)
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
