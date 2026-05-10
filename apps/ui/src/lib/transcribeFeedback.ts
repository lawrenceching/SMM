import { toast } from "sonner"
import { Path } from "@core/path"
import {
  transcribeWithVideoCaptioner,
  type VideoCaptionerTranscribeAsr,
  type VideoCaptionerTranscribeFormat,
} from "@/api/videocaptioner"
import { transcribeWithTencentAsr } from "@/api/tencentAsr"

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

export type TranscribeTracksOptions =
  | {
      provider: "videoCaptioner"
      asr?: VideoCaptionerTranscribeAsr
      language?: string
      wordTimestamps?: boolean
      format?: VideoCaptionerTranscribeFormat
    }
  | {
      provider: "tencentAsr"
      baseUrl: string
      apiKey: string
    }

export async function transcribeTracksWithFeedback(
  rows: TranscribeFeedbackRow[],
  deps: TranscribeDeps,
  options?: TranscribeTracksOptions,
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

  const provider = options?.provider ?? "videoCaptioner"

  for (const item of queued) {
    deps.markTranscribeJobRunning(item.jobId)
    toast.success(`Transcribe start: "${item.row.title}".`)
    try {
      let result: { success?: boolean; error?: string }

      if (provider === "tencentAsr") {
        if (options?.provider !== "tencentAsr") {
          deps.markTranscribeJobFailed(item.jobId)
          toast.error(`Could not transcribe "${item.row.title}". Invalid transcribe options.`)
          continue
        }
        result = await transcribeWithTencentAsr({
          mediaPath: item.mediaPath,
          baseUrl: options.baseUrl,
          apiKey: options.apiKey,
        })
      } else {
        const vc =
          options?.provider === "videoCaptioner" || options === undefined ? options : undefined
        result = await transcribeWithVideoCaptioner({
          mediaPath: item.mediaPath,
          ...(vc?.asr !== undefined ? { asr: vc.asr } : {}),
          ...(vc?.language !== undefined ? { language: vc.language } : {}),
          ...(vc?.wordTimestamps !== undefined ? { wordTimestamps: vc.wordTimestamps } : {}),
          ...(vc?.format !== undefined ? { format: vc.format } : {}),
        })
      }

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
  options?: TranscribeTracksOptions,
): Promise<void> {
  await transcribeTracksWithFeedback([row], deps, options)
}
