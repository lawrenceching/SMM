import { useCallback } from "react"
import { toast } from "sonner"
import { basename } from "@/lib/path"
import { UITranscribeDialog } from "./UITranscribeDialog"
import type {
  TranscribeAsrEngine,
  TranscribeDialogConfirmPayload,
  TranscribeDialogProps,
} from "./types"
import { useFeatures } from "@/hooks/useFeatures"
import { useVideoCaptionerStatus } from "@/hooks/useVideoCaptionerStatus"
import { buildTranscribeJob } from "@/lib/transcribeJobFactory"
import { useJobManager } from "@/hooks/useJobManager"

/** Not selectable in the dialog UI (still listed). */
const TRANSCRIBE_DIALOG_DISABLED_ASR_ENGINES = ["whisper-cpp"] as const satisfies readonly TranscribeAsrEngine[]

/**
 * Closes immediately after confirm, then enqueues transcribe jobs (IndexedDB + Service Worker).
 */
export function TranscribeDialog({ rows, onClose, folder, ...rest }: TranscribeDialogProps) {
  const { isVideoCaptionerAsrOptionsEnabled, isTencentAsrTranscribeEnabled } = useFeatures()
  const { isAvailable: videoCaptionerAvailable } = useVideoCaptionerStatus()
  const { createJob } = useJobManager()

  const handleConfirm = useCallback(
    async (payload: TranscribeDialogConfirmPayload) => {
      const folderTrimmed = folder?.trim()
      if (!folderTrimmed) {
        toast.error("Media folder is not available; cannot start transcription.")
        return
      }

      const byId = new Map(rows.map((r) => [r.id, r]))
      let saved = 0
      const vcOptions =
        payload.provider === "videoCaptioner" ? payload.videoCaptioner : undefined
      for (const id of payload.selectedIds) {
        const row = byId.get(id)
        if (!row?.path) {
          toast.error(
            `Track "${row?.title ?? id}" does not have an associated file path.`,
          )
          continue
        }
        const displayTitle = row.title?.trim() || basename(row.path) || row.path

        const job = buildTranscribeJob({
          folder: folderTrimmed,
          mediaPath: row.path,
          title: displayTitle,
          provider: payload.provider,
          ...(payload.provider === "tencentAsr" && payload.tencentAsr
            ? { tencentAsr: payload.tencentAsr }
            : {}),
          ...(payload.provider === "videoCaptioner" && isVideoCaptionerAsrOptionsEnabled && vcOptions
            ? {
                videoCaptioner: {
                  asr: vcOptions.asr,
                  language: vcOptions.language,
                  ...(vcOptions.wordTimestamps ? { wordTimestamps: true as const } : {}),
                  format: vcOptions.format,
                },
              }
            : {}),
        })

        await createJob(job)
        saved += 1
      }

      if (saved === 0) return
      onClose()
    },
    [rows, onClose, folder, isVideoCaptionerAsrOptionsEnabled],
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
