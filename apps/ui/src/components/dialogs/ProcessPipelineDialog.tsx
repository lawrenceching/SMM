import { useCallback } from "react"
import { toast } from "sonner"
import { basename } from "@/lib/path"
import { UIProcessPipelineDialog } from "./UIProcessPipelineDialog"
import type {
  ProcessPipelineConfirmPayload,
  ProcessPipelineDialogProps,
  TranscribeAsrEngine,
} from "./types"
import { buildProcessJob } from "@/lib/processJobFactory"
import { useVideoCaptionerStatus } from "@/hooks/useVideoCaptionerStatus"
import { useFeatures } from "@/hooks/useFeatures"
import { useTranslation } from "@/lib/i18n"
import { useJobManager } from "@/hooks/useJobManager"

const PROCESS_PIPELINE_DISABLED_ASR_ENGINES = ["whisper-cpp"] as const satisfies readonly TranscribeAsrEngine[]

export function ProcessPipelineDialog({ rows, onClose, folder, ...rest }: ProcessPipelineDialogProps) {
  const { isAvailable: videoCaptionerAvailable } = useVideoCaptionerStatus()
  const { isVideoCaptionerAsrOptionsEnabled } = useFeatures()
  const { t } = useTranslation("components")
  const { createJobs } = useJobManager()

  const handleConfirm = useCallback(
    async (payload: ProcessPipelineConfirmPayload) => {
      const folderTrimmed = folder?.trim()
      if (!folderTrimmed) {
        toast.error(t("processPipelineDialog.noMediaFolder"))
        return
      }
      const byId = new Map(rows.map((r) => [r.id, r]))
      const jobs = []
      for (const id of payload.selectedIds) {
        const row = byId.get(id)
        if (!row?.eligible || !row.mediaPath) {
          toast.error(t("processPipelineDialog.notEligible"))
          continue
        }
        const displayTitle = row.title?.trim() || basename(row.mediaPath) || row.mediaPath

        jobs.push(buildProcessJob({
          folder: folderTrimmed,
          mediaPath: row.mediaPath,
          title: displayTitle,
          asr: payload.asr,
          language: payload.language,
          wordTimestamps: payload.wordTimestamps,
          format: payload.format,
          noOptimize: payload.noOptimize,
          noSplit: payload.noSplit,
          reflect: payload.reflect,
          ...(payload.layout !== undefined ? { layout: payload.layout } : {}),
          ...(payload.prompt !== undefined && payload.prompt.trim() !== ""
            ? { prompt: payload.prompt.trim() }
            : {}),
          ...(payload.noTranslate
            ? { noTranslate: true as const }
            : {
                translator: payload.translator!,
                targetLanguage: payload.targetLanguage!,
                ...(payload.llm ? { llm: payload.llm } : {}),
              }),
          noSynthesize: payload.noSynthesize,
          ...(!payload.noSynthesize
            ? {
                ...(payload.subtitleMode !== undefined ? { subtitleMode: payload.subtitleMode } : {}),
                ...(payload.quality !== undefined ? { quality: payload.quality } : {}),
                ...(payload.style !== undefined && payload.style.trim() !== ""
                  ? { style: payload.style.trim() }
                  : {}),
                ...(payload.renderMode !== undefined ? { renderMode: payload.renderMode } : {}),
                ...(payload.synthesizeLayout !== undefined
                  ? { synthesizeLayout: payload.synthesizeLayout }
                  : {}),
              }
            : {}),
        }))
      }

      if (jobs.length === 0) return

      const result = await createJobs(jobs)
      if (result.failures.length > 0) {
        toast.error(t("processPipelineDialog.partialFailure", { count: result.failures.length }))
      }
      onClose()
    },
    [rows, onClose, folder, t, createJobs],
  )

  return (
    <UIProcessPipelineDialog
      {...rest}
      rows={rows}
      onClose={onClose}
      folder={folder}
      videoCaptionerAvailable={videoCaptionerAvailable}
      asrOptionsEnabled={isVideoCaptionerAsrOptionsEnabled}
      disabledAsrEngines={PROCESS_PIPELINE_DISABLED_ASR_ENGINES}
      onConfirm={handleConfirm}
    />
  )
}
