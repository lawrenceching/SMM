import { useCallback } from "react"
import { toast } from "sonner"
import { Path } from "@smm/utils/path"
import { basename } from "@/lib/path"
import { UISynthesizeSubtitleDialog } from "./UISynthesizeSubtitleDialog"
import type { SynthesizeSubtitleDialogProps, SynthesizeSubtitleConfirmPayload } from "./types"
import { useVideoCaptionerStatus } from "@/hooks/useVideoCaptionerStatus"
import { synthesizeSubtitleViaCore } from "@/api/synthesizeSubtitle"
import {
  applySynthesizeSubtitlePollUpdate,
  pollSubtitleJob,
  upsertSynthesizeSubtitleJobFromCore,
} from "@/lib/pollSubtitleJob"
import { useBackgroundJobsStore } from "@/stores/backgroundJobsStore"

/**
 * Closes immediately after confirm, then enqueues Core synthesize-subtitle jobs and polls.
 */
export function SynthesizeSubtitleDialog({ rows, onClose, folder, ...rest }: SynthesizeSubtitleDialogProps) {
  const { isAvailable: videoCaptionerAvailable } = useVideoCaptionerStatus()

  const handleConfirm = useCallback(
    async (payload: SynthesizeSubtitleConfirmPayload) => {
      const folderTrimmed = folder?.trim()
      if (!folderTrimmed) {
        toast.error("Media folder is not available; cannot start synthesis.")
        return
      }
      const byId = new Map(rows.map((r) => [r.id, r]))
      let saved = 0
      for (const id of payload.selectedIds) {
        const row = byId.get(id)
        if (!row?.eligible || !row.videoPath || !row.subtitlePath) {
          toast.error(`"${row?.title ?? id}" is not eligible for synthesis.`)
          continue
        }
        const displayTitle = row.title?.trim() || basename(row.videoPath) || row.videoPath
        const videoPath = Path.toPlatformPath(Path.posix(row.videoPath))
        const subtitlePath = Path.toPlatformPath(Path.posix(row.subtitlePath))

        try {
          const jobId = await synthesizeSubtitleViaCore({
            folder: folderTrimmed,
            videoPath,
            subtitlePath,
            title: displayTitle,
            subtitleMode: payload.subtitleMode,
            quality: payload.quality,
            ...(payload.style !== undefined ? { style: payload.style } : {}),
            ...(payload.renderMode !== undefined ? { renderMode: payload.renderMode } : {}),
            ...(payload.layout !== undefined ? { layout: payload.layout } : {}),
          })

          upsertSynthesizeSubtitleJobFromCore({
            id: jobId,
            folder: folderTrimmed,
            videoPath,
            subtitlePath,
            title: displayTitle,
            subtitleMode: payload.subtitleMode,
            quality: payload.quality,
            ...(payload.style !== undefined ? { style: payload.style } : {}),
            ...(payload.renderMode !== undefined ? { renderMode: payload.renderMode } : {}),
            ...(payload.layout !== undefined ? { layout: payload.layout } : {}),
            status: "pending",
            progress: 0,
          })

          void pollSubtitleJob(jobId, "synthesize-subtitle", (job) => {
            applySynthesizeSubtitlePollUpdate(job)
          }).catch((error: unknown) => {
            console.error("[SynthesizeSubtitleDialog] poll synthesize-subtitle job failed:", error)
            useBackgroundJobsStore.getState().updateJob(jobId, { status: "failed" })
          })

          saved += 1
        } catch (error) {
          console.error("[SynthesizeSubtitleDialog] Failed to enqueue synthesize:", videoPath, error)
          toast.error(error instanceof Error ? error.message : "Synthesis failed")
        }
      }

      if (saved === 0) return
      onClose()
    },
    [rows, onClose, folder],
  )

  return (
    <UISynthesizeSubtitleDialog
      {...rest}
      rows={rows}
      onClose={onClose}
      folder={folder}
      videoCaptionerAvailable={videoCaptionerAvailable}
      onConfirm={handleConfirm}
    />
  )
}
