import { useCallback } from "react"
import { toast } from "sonner"
import { Path } from "@smm/utils/path"
import { basename } from "@/lib/path"
import { UISubtitleTranslationDialog } from "./UISubtitleTranslationDialog"
import type { SubtitleTranslationDialogProps, SubtitleTranslationConfirmPayload } from "./types"
import { useVideoCaptionerStatus } from "@/hooks/useVideoCaptionerStatus"
import { translateSubtitleViaCore } from "@/api/translateSubtitle"
import {
  applyTranslateSubtitlePollUpdate,
  pollSubtitleJob,
  upsertTranslateSubtitleJobFromCore,
} from "@/lib/pollSubtitleJob"
import { useBackgroundJobsStore } from "@/stores/backgroundJobsStore"

export function SubtitleTranslationDialog({ rows, onClose, folder, ...rest }: SubtitleTranslationDialogProps) {
  const { isAvailable: videoCaptionerAvailable } = useVideoCaptionerStatus()

  const handleConfirm = useCallback(
    async (payload: SubtitleTranslationConfirmPayload) => {
      const folderTrimmed = folder?.trim()
      if (!folderTrimmed) {
        toast.error("Media folder is not available; cannot start translation.")
        return
      }
      const byId = new Map(rows.map((r) => [r.id, r]))
      let saved = 0
      for (const id of payload.selectedIds) {
        const row = byId.get(id)
        if (!row?.eligible || !row.path) {
          toast.error(`"${row?.title ?? id}" is not eligible for translation.`)
          continue
        }
        const displayTitle = row.title?.trim() || basename(row.path) || row.path
        const subtitlePath = Path.toPlatformPath(Path.posix(row.path))
        const mediaPath = row.mediaPath?.trim()
          ? Path.toPlatformPath(Path.posix(row.mediaPath))
          : undefined

        try {
          const jobId = await translateSubtitleViaCore({
            folder: folderTrimmed,
            subtitlePath,
            translator: payload.translator,
            targetLanguage: payload.targetLanguage,
            title: displayTitle,
            ...(mediaPath ? { mediaPath } : {}),
            ...(payload.reflect ? { reflect: true as const } : {}),
            ...(payload.layout !== undefined ? { layout: payload.layout } : {}),
            ...(payload.translator === "llm" && payload.llm ? { llm: payload.llm } : {}),
          })

          upsertTranslateSubtitleJobFromCore({
            id: jobId,
            folder: folderTrimmed,
            subtitlePath,
            ...(mediaPath ? { mediaPath } : {}),
            title: displayTitle,
            translator: payload.translator,
            targetLanguage: payload.targetLanguage,
            ...(payload.reflect ? { reflect: true as const } : {}),
            ...(payload.layout !== undefined ? { layout: payload.layout } : {}),
            status: "pending",
            progress: 0,
          })

          void pollSubtitleJob(jobId, "translate-subtitle", (job) => {
            applyTranslateSubtitlePollUpdate(job)
          }).catch((error: unknown) => {
            console.error("[SubtitleTranslationDialog] poll translate-subtitle job failed:", error)
            useBackgroundJobsStore.getState().updateJob(jobId, { status: "failed" })
          })

          saved += 1
        } catch (error) {
          console.error("[SubtitleTranslationDialog] Failed to enqueue translate:", subtitlePath, error)
          toast.error(error instanceof Error ? error.message : "Translation failed")
        }
      }

      if (saved === 0) return
      onClose()
    },
    [rows, onClose, folder],
  )

  return (
    <UISubtitleTranslationDialog
      {...rest}
      rows={rows}
      onClose={onClose}
      folder={folder}
      videoCaptionerAvailable={videoCaptionerAvailable}
      onConfirm={handleConfirm}
    />
  )
}
