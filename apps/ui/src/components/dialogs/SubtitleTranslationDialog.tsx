import { useCallback } from "react"
import { toast } from "sonner"
import { basename } from "@/lib/path"
import { UISubtitleTranslationDialog } from "./UISubtitleTranslationDialog"
import type { SubtitleTranslationDialogProps, SubtitleTranslationConfirmPayload } from "./types"
import { buildTranslateJob } from "@/lib/translateJobFactory"
import { useVideoCaptionerStatus } from "@/hooks/useVideoCaptionerStatus"
import { useJobOrchestrator } from "@/hooks/useJobOrchestrator"

export function SubtitleTranslationDialog({ rows, onClose, folder, ...rest }: SubtitleTranslationDialogProps) {
  const { isAvailable: videoCaptionerAvailable } = useVideoCaptionerStatus()
  const { createJob } = useJobOrchestrator()

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

        const job = buildTranslateJob({
          folder: folderTrimmed,
          subtitlePath: row.path,
          title: displayTitle,
          mediaPath: row.mediaPath,
          translator: payload.translator,
          targetLanguage: payload.targetLanguage,
          ...(payload.reflect ? { reflect: true } : {}),
          ...(payload.layout !== undefined ? { layout: payload.layout } : {}),
          ...(payload.translator === "llm" && payload.llm ? { llm: payload.llm } : {}),
        })

        await createJob(job)
        saved += 1
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
