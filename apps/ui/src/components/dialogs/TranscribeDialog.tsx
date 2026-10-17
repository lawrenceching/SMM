import { useCallback } from "react"
import { toast } from "sonner"
import { Path } from "@smm/utils/path"
import { basename } from "@/lib/path"
import { UITranscribeDialog } from "./UITranscribeDialog"
import type {
  TranscribeAsrEngine,
  TranscribeDialogConfirmPayload,
  TranscribeDialogProps,
} from "./types"
import { useFeatures } from "@/hooks/useFeatures"
import { useVideoCaptionerStatus } from "@/hooks/useVideoCaptionerStatus"
import { transcribeSubtitleViaCore } from "@/api/transcribeSubtitle"
import {
  applyTranscribeSubtitlePollUpdate,
  pollSubtitleJob,
  upsertTranscribeSubtitleJobFromCore,
} from "@/lib/pollSubtitleJob"
import { useBackgroundJobsStore } from "@/stores/backgroundJobsStore"

/** Not selectable in the dialog UI (still listed). */
const TRANSCRIBE_DIALOG_DISABLED_ASR_ENGINES = ["whisper-cpp"] as const satisfies readonly TranscribeAsrEngine[]

/**
 * Closes immediately after confirm, then enqueues Core transcribe-subtitle jobs and polls.
 */
export function TranscribeDialog({ rows, onClose, folder, ...rest }: TranscribeDialogProps) {
  const { isVideoCaptionerAsrOptionsEnabled, isTencentAsrTranscribeEnabled } = useFeatures()
  const { isAvailable: videoCaptionerAvailable } = useVideoCaptionerStatus()

  const handleConfirm = useCallback(
    async (payload: TranscribeDialogConfirmPayload) => {
      const folderTrimmed = folder?.trim()
      if (!folderTrimmed) {
        toast.error("Media folder is not available; cannot start transcription.")
        return
      }

      if (payload.provider === "tencentAsr") {
        toast.error("Tencent ASR is not available in this version")
        return
      }

      const byId = new Map(rows.map((r) => [r.id, r]))
      let saved = 0
      const vcOptions = payload.videoCaptioner
      const asr = vcOptions?.asr ?? "bijian"

      for (const id of payload.selectedIds) {
        const row = byId.get(id)
        if (!row?.path) {
          toast.error(
            `Track "${row?.title ?? id}" does not have an associated file path.`,
          )
          continue
        }
        const displayTitle = row.title?.trim() || basename(row.path) || row.path
        const mediaPath = Path.toPlatformPath(Path.posix(row.path))

        try {
          const jobId = await transcribeSubtitleViaCore({
            folder: folderTrimmed,
            mediaPath,
            title: displayTitle,
            asr,
            ...(vcOptions?.language?.trim() ? { language: vcOptions.language.trim() } : {}),
            ...(vcOptions?.wordTimestamps ? { wordTimestamps: true as const } : {}),
            ...(vcOptions?.format?.trim()
              ? { format: vcOptions.format }
              : {}),
          })

          upsertTranscribeSubtitleJobFromCore({
            id: jobId,
            folder: folderTrimmed,
            mediaPath,
            title: displayTitle,
            asr,
            ...(vcOptions?.language?.trim() ? { language: vcOptions.language.trim() } : {}),
            ...(vcOptions?.wordTimestamps ? { wordTimestamps: true as const } : {}),
            ...(vcOptions?.format?.trim() ? { format: vcOptions.format } : {}),
            status: "pending",
            progress: 0,
          })

          void pollSubtitleJob(jobId, "transcribe-subtitle", (job) => {
            applyTranscribeSubtitlePollUpdate(job)
          }).catch((error: unknown) => {
            console.error("[TranscribeDialog] poll transcribe-subtitle job failed:", error)
            useBackgroundJobsStore.getState().updateJob(jobId, { status: "failed" })
          })

          saved += 1
        } catch (error) {
          console.error("[TranscribeDialog] Failed to enqueue transcribe:", mediaPath, error)
          toast.error(error instanceof Error ? error.message : "Transcription failed")
        }
      }

      if (saved === 0) return
      onClose()
    },
    [rows, onClose, folder],
  )

  return (
    <UITranscribeDialog
      {...rest}
      rows={rows}
      onClose={onClose}
      folder={folder}
      asrOptionsEnabled={isVideoCaptionerAsrOptionsEnabled}
      tencentAsrEnabled={isTencentAsrTranscribeEnabled}
      videoCaptionerAvailable={videoCaptionerAvailable}
      disabledAsrEngines={TRANSCRIBE_DIALOG_DISABLED_ASR_ENGINES}
      onConfirm={handleConfirm}
    />
  )
}
