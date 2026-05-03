import { toast } from "sonner"
import { Path } from "@core/path"
import { transcribeWithVideoCaptioner } from "@/api/videocaptioner"

export interface TranscribeDeps {
  createTranscribeJob: (trackTitle: string, mediaPath: string) => string
  markTranscribeJobRunning: (id: string) => void
  markTranscribeJobSucceeded: (id: string) => void
  markTranscribeJobFailed: (id: string) => void
}

/** Minimal row shape for transcribe toasts and API (e.g. MusicFileRow when path is set). */
export interface TranscribeFeedbackRow {
  title: string
  path?: string
}

export async function transcribeTracksWithFeedback(
  rows: TranscribeFeedbackRow[],
  deps: TranscribeDeps,
): Promise<void> {
  const queued = rows
    .filter((row) => {
      if (row.path) return true
      toast.error(`Track "${row.title}" does not have an associated file path.`)
      return false
    })
    .map((row) => {
      const mediaPath = Path.toPlatformPath(row.path!)
      const jobId = deps.createTranscribeJob(row.title, mediaPath)
      return { row, mediaPath, jobId }
    })

  for (const item of queued) {
    deps.markTranscribeJobRunning(item.jobId)
    toast.success(`Transcribe start: "${item.row.title}".`)
    try {
      const result = await transcribeWithVideoCaptioner({ mediaPath: item.mediaPath })
      if (result.error) {
        deps.markTranscribeJobFailed(item.jobId)
        toast.error(`Could not transcribe "${item.row.title}". ${result.error}`)
        continue
      }
      deps.markTranscribeJobSucceeded(item.jobId)
      toast.success(`Transcription completed for "${item.row.title}".`)
    } catch (error) {
      deps.markTranscribeJobFailed(item.jobId)
      toast.error(
        `Could not transcribe "${item.row.title}". ${error instanceof Error ? error.message : "Unknown error"}`,
      )
    }
  }
}

export async function transcribeTrackWithFeedback(
  row: TranscribeFeedbackRow,
  deps: TranscribeDeps,
): Promise<void> {
  await transcribeTracksWithFeedback([row], deps)
}
