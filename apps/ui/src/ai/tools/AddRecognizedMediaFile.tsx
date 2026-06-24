import { makeAssistantTool, tool } from "@assistant-ui/react"
import { z } from "zod"
import { Path } from "@core/path"
import type { RecognizeMediaFilePlan } from "@core/types/RecognizeMediaFilePlan"
import { updatePlan } from "@/api/updatePlan"
import { checkFileExists } from "@/lib/utils"
import { setPlanDraft } from "../plan/aiPlanDrafts"
import { resolveRecognizePlanDraft } from "../plan/recognizePlanService"

/**
 * Frontend AI tool: `add-recognized-media-file`.
 *
 * Appends a `{ season, episode, path }` entry to a recognize-media-file
 * plan created by `beginRecognizeTask`. The plan is persisted on the
 * backend via the unified `/api/updatePlan` endpoint; entries are
 * accumulated in the in-memory draft store between `begin` and `end`.
 *
 * The path is validated against the filesystem before being added so
 * the AI cannot silently queue a non-existent file for the user to
 * confirm later. The check uses {@link checkFileExists} (HTTP-backed
 * `listFiles` on the cli) so it works in both the browser-only mode
 * and the Electron desktop app.
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
      const normalizedFilePath = Path.posix(filePath)

      // Reject non-existent files before they enter the plan. The
      // filesystem check is HTTP-backed via the cli `/api/listFiles`
      // endpoint, so the AI sees a failed tool call instead of a
      // silent queue-up that the user has to unwind at confirmation.
      const exists = await checkFileExists(normalizedFilePath)
      if (!exists) {
        return {
          error:
            `Error Reason: File "${normalizedFilePath}" (S${season}E${episode}) does not exist in the media folder. ` +
            `Call "list-files-in-media-folder" tool to discover the actual file paths inside the folder before calling add-recognized-media-file again.`,
        }
      }

      const plan = await resolveRecognizePlanDraft(taskId)
      if (!plan) {
        return {
          error: `Error Reason: Task with id "${taskId.trim()}" not found`,
        }
      }

      const files = [
        ...plan.files,
        { season, episode, path: normalizedFilePath },
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
