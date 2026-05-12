import { useCallback } from "react"
import { toast } from "sonner"
import { basename } from "@/lib/path"
import { UISynthesizeSubtitleDialog } from "./UISynthesizeSubtitleDialog"
import type { SynthesizeSubtitleDialogProps, SynthesizeSubtitleConfirmPayload } from "./types"
import { buildSynthesizeJob } from "@/lib/synthesizeJobFactory"
import { saveSynthesizeJob } from "@/lib/downloadTaskDb"
import { useVideoCaptionerStatus } from "@/hooks/useVideoCaptionerStatus"

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

        const job = buildSynthesizeJob({
          folder: folderTrimmed,
          videoPath: row.videoPath,
          subtitlePath: row.subtitlePath,
          title: displayTitle,
          subtitleMode: payload.subtitleMode,
          quality: payload.quality,
          ...(payload.style !== undefined ? { style: payload.style } : {}),
          ...(payload.renderMode !== undefined ? { renderMode: payload.renderMode } : {}),
          ...(payload.layout !== undefined ? { layout: payload.layout } : {}),
        })

        await saveSynthesizeJob(job)
        saved += 1
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
