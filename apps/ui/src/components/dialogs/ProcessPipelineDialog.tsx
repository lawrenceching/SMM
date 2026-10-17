import { useCallback } from "react"
import { toast } from "sonner"
import { Path } from "@smm/utils/path"
import { basename } from "@/lib/path"
import { UIProcessPipelineDialog } from "./UIProcessPipelineDialog"
import type {
  ProcessPipelineConfirmPayload,
  ProcessPipelineDialogProps,
  TranscribeAsrEngine,
} from "./types"
import { useVideoCaptionerStatus } from "@/hooks/useVideoCaptionerStatus"
import { useFeatures } from "@/hooks/useFeatures"
import { useTranslation } from "@/lib/i18n"
import { processSubtitleViaCore } from "@/api/processSubtitle"
import {
  applyProcessSubtitlePollUpdate,
  pollSubtitleJob,
  upsertProcessSubtitleJobFromCore,
} from "@/lib/pollSubtitleJob"
import { useBackgroundJobsStore } from "@/stores/backgroundJobsStore"

const PROCESS_PIPELINE_DISABLED_ASR_ENGINES = ["whisper-cpp"] as const satisfies readonly TranscribeAsrEngine[]

/**
 * Closes immediately after confirm, then enqueues Core process-subtitle jobs and polls.
 * LLM credentials are sent only on the HTTP request; never stored in Zustand job data.
 */
export function ProcessPipelineDialog({ rows, onClose, folder, ...rest }: ProcessPipelineDialogProps) {
  const { isAvailable: videoCaptionerAvailable } = useVideoCaptionerStatus()
  const { isVideoCaptionerAsrOptionsEnabled } = useFeatures()
  const { t } = useTranslation("components")

  const handleConfirm = useCallback(
    async (payload: ProcessPipelineConfirmPayload) => {
      const folderTrimmed = folder?.trim()
      if (!folderTrimmed) {
        toast.error(t("processPipelineDialog.noMediaFolder"))
        return
      }
      const byId = new Map(rows.map((r) => [r.id, r]))
      let saved = 0
      for (const id of payload.selectedIds) {
        const row = byId.get(id)
        if (!row?.eligible || !row.mediaPath) {
          toast.error(t("processPipelineDialog.notEligible"))
          continue
        }
        const displayTitle = row.title?.trim() || basename(row.mediaPath) || row.mediaPath
        const mediaPath = Path.toPlatformPath(Path.posix(row.mediaPath))

        try {
          const jobId = await processSubtitleViaCore({
            folder: folderTrimmed,
            mediaPath,
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
          })

          upsertProcessSubtitleJobFromCore({
            id: jobId,
            folder: folderTrimmed,
            mediaPath,
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
            status: "pending",
            progress: 0,
          })

          void pollSubtitleJob(jobId, "process-subtitle", (job) => {
            applyProcessSubtitlePollUpdate(job)
          }).catch((error: unknown) => {
            console.error("[ProcessPipelineDialog] poll process-subtitle job failed:", error)
            useBackgroundJobsStore.getState().updateJob(jobId, { status: "failed" })
          })

          saved += 1
        } catch (error) {
          console.error("[ProcessPipelineDialog] Failed to enqueue process:", mediaPath, error)
          toast.error(error instanceof Error ? error.message : "Process pipeline failed")
        }
      }

      if (saved === 0) return
      onClose()
    },
    [rows, onClose, folder, t],
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
