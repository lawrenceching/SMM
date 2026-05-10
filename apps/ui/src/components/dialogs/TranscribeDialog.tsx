import { useCallback } from "react"
import { toast } from "sonner"
import { basename } from "@/lib/path"
import { UITranscribeDialog } from "./UITranscribeDialog"
import type {
  TranscribeAsrEngine,
  TranscribeDialogConfirmPayload,
  TranscribeDialogProps,
} from "./types"
import { transcribeTracksWithFeedback } from "@/lib/transcribeFeedback"
import { useBackgroundJobsStore } from "@/stores/backgroundJobsStore"
import { useFeatures } from "@/hooks/useFeatures"
import { useVideoCaptionerStatus } from "@/hooks/useVideoCaptionerStatus"

/** Not selectable in the dialog UI (still listed). */
const TRANSCRIBE_DIALOG_DISABLED_ASR_ENGINES = ["whisper-cpp"] as const satisfies readonly TranscribeAsrEngine[]

/**
 * Closes immediately after confirm, then runs transcribe in the background (toasts + background jobs).
 */
export function TranscribeDialog({ rows, onClose, ...rest }: TranscribeDialogProps) {
  const {
    createTranscribeJob,
    markTranscribeJobRunning,
    markTranscribeJobSucceeded,
    markTranscribeJobFailed,
  } = useBackgroundJobsStore()
  const { isVideoCaptionerAsrOptionsEnabled, isTencentAsrTranscribeEnabled } = useFeatures()
  const { isAvailable: videoCaptionerAvailable } = useVideoCaptionerStatus()

  const handleConfirm = useCallback(
    (payload: TranscribeDialogConfirmPayload) => {
      const byId = new Map(rows.map((r) => [r.id, r]))
      const feedbackRows: { title: string; path: string }[] = []
      for (const id of payload.selectedIds) {
        const row = byId.get(id)
        if (!row?.path) {
          toast.error(
            `Track "${row?.title ?? id}" does not have an associated file path.`,
          )
          continue
        }
        const displayTitle = row.title?.trim() || basename(row.path) || row.path
        feedbackRows.push({ title: displayTitle, path: row.path })
      }
      if (feedbackRows.length === 0) return
      onClose()

      const deps = {
        createTranscribeJob,
        markTranscribeJobRunning,
        markTranscribeJobSucceeded,
        markTranscribeJobFailed,
      }

      if (payload.provider === "tencentAsr" && payload.tencentAsr) {
        void transcribeTracksWithFeedback(feedbackRows, deps, {
          provider: "tencentAsr",
          baseUrl: payload.tencentAsr.baseUrl,
          apiKey: payload.tencentAsr.apiKey,
        })
        return
      }

      const vc = payload.videoCaptioner
      if (isVideoCaptionerAsrOptionsEnabled && vc) {
        void transcribeTracksWithFeedback(feedbackRows, deps, {
          provider: "videoCaptioner",
          asr: vc.asr,
          language: vc.language,
          ...(vc.wordTimestamps ? { wordTimestamps: true as const } : {}),
          format: vc.format,
        })
      } else {
        void transcribeTracksWithFeedback(feedbackRows, deps, { provider: "videoCaptioner" })
      }
    },
    [
      rows,
      onClose,
      createTranscribeJob,
      markTranscribeJobRunning,
      markTranscribeJobSucceeded,
      markTranscribeJobFailed,
      isVideoCaptionerAsrOptionsEnabled,
    ],
  )

  return (
    <UITranscribeDialog
      {...rest}
      rows={rows}
      onClose={onClose}
      asrOptionsEnabled={isVideoCaptionerAsrOptionsEnabled}
      tencentAsrEnabled={isTencentAsrTranscribeEnabled}
      videoCaptionerAvailable={videoCaptionerAvailable}
      disabledAsrEngines={TRANSCRIBE_DIALOG_DISABLED_ASR_ENGINES}
      onConfirm={handleConfirm}
    />
  )
}
