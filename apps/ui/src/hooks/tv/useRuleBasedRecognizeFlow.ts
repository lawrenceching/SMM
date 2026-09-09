import { useCallback, useMemo, useState } from "react"
import { toast } from "sonner"
import { useApplyPlanMutation } from "@/hooks/plans/useApplyPlanMutation"
import { useRejectPlanMutation } from "@/hooks/plans/useRejectPlanMutation"
import { useTryToRecognizeEpisodesMutation } from "@/hooks/plans/useTryToRecognizeEpisodesMutation"
import {
  isRuleBasedRecognizePlanComplete,
  isRuleBasedRecognizePlanFullyUnchanged,
} from "@/lib/isRuleBasedRecognizePlanComplete"
import { useTranslation } from "@/lib/i18n"
import type { MediaMetadata } from "@smm/types"
import type { RecognizeMediaFilePlan } from "@smm/types/RecognizeMediaFilePlan"

export interface UseRuleBasedRecognizeFlowOptions {
  mediaMetadata: MediaMetadata | undefined
}

/**
 * Rule-based recognize flow aligned with docs/dev/recognize-episodes.md:
 * try-to-recognize-episodes → apply-plan (data.files for selected episodes) / reject-plan.
 */
export function useRuleBasedRecognizeFlow({
  mediaMetadata,
}: UseRuleBasedRecognizeFlowOptions) {
  const { t } = useTranslation(["components"])

  const [open, setOpen] = useState(false)
  const [plan, setPlan] = useState<RecognizeMediaFilePlan | undefined>(undefined)

  const mediaFolderPath = mediaMetadata?.mediaFolderPath
  const rejectPlanMutation = useRejectPlanMutation()
  const applyPlanMutation = useApplyPlanMutation()
  const tryToRecognizeMutation = useTryToRecognizeEpisodesMutation()

  const loading =
    rejectPlanMutation.isPending ||
    applyPlanMutation.isPending ||
    tryToRecognizeMutation.isPending

  const recognizeFailedMessage = t("toast.recognizeFailed", {
    defaultValue: "Recognition failed. Please try again.",
  })
  const noRecognizedFilesMessage = t("toast.noRecognizedFiles", {
    defaultValue:
      "Unable to recognize any episodes. Consider using AI to recognize instead.",
  })

  const reset = useCallback(() => {
    rejectPlanMutation.reset()
    applyPlanMutation.reset()
    tryToRecognizeMutation.reset()
  }, [rejectPlanMutation, applyPlanMutation, tryToRecognizeMutation])

  const confirm = useCallback(
    async (selectedEpisodeFiles?: string[]) => {
      if (plan === undefined) {
        console.error("Plan was confirmed but the plan is undefined")
        return
      }

      if (!mediaMetadata || !mediaFolderPath) {
        console.warn("[recognize] user confirmed but media metadata missing", { plan })
        toast.error("No media metadata available")
        return
      }

      try {
        console.log("[recognize] POST /api/apply-plan", {
          id: plan.id,
          selectedCount: selectedEpisodeFiles?.length,
        })
        await applyPlanMutation.mutateAsync({
          id: plan.id,
          mediaFolderPath,
          files: selectedEpisodeFiles,
        })

        setOpen(false)
        setPlan(undefined)
        toast.success(t("toolbar.recognizeEpisodesSuccess"))
        console.log("[recognize] recognize completed successfully", { id: plan.id })
      } catch (error) {
        console.error("[recognize] unexpected error while applying recognize", { id: plan.id, error })
        toast.error(recognizeFailedMessage)
      }
    },
    [mediaFolderPath, plan, mediaMetadata, applyPlanMutation, recognizeFailedMessage, t],
  )

  const cancel = useCallback(async () => {
    if (mediaFolderPath === undefined) {
      console.error("Media folder path is undefined")
      return
    }

    setOpen(false)

    if (plan && plan.status === "pending") {
      rejectPlanMutation.mutateAsync({ id: plan.id, mediaFolderPath }) // fire and forget
    }

    setPlan(undefined)
    reset()
  }, [mediaFolderPath, rejectPlanMutation, plan, reset])

  /** Opens RuleBasedRecognizePrompt by calling try-to-recognize-episodes. */
  const start = useCallback(() => {
    if (!mediaFolderPath) {
      console.warn("[recognize] cannot start — media folder path missing")
      toast.error("No media folder path available")
      return
    }
    reset()
    setOpen(true)
    void tryToRecognizeMutation.mutateAsync({ mediaFolderPath })
      .then((resp) => {
        if (!resp.files || resp.files.length === 0) {
          console.log("[recognize] no files recognized", { mediaFolderPath })
          toast.error(noRecognizedFilesMessage)
          rejectPlanMutation.mutateAsync({ id: resp.id, mediaFolderPath }) // fire and forget
          setOpen(false)
          return
        }
        console.log("[recognize] recognize preview ready", {
          id: resp.id,
          matchedCount: resp.files.length,
        })
        setPlan(resp)
      })
      .catch((error) => {
        console.error("[recognize] failed to create recognize plan", { mediaFolderPath, error })
        toast.error(recognizeFailedMessage)
        setOpen(false)
      })
  }, [
    mediaFolderPath,
    reset,
    tryToRecognizeMutation,
    rejectPlanMutation,
    noRecognizedFilesMessage,
    recognizeFailedMessage,
  ])

  const tvShowTitle = mediaMetadata?.tvShow?.name ?? ""
  const tvShowTmdbId = parseInt(mediaMetadata?.tvShow?.id ?? "0", 10)

  const notAllEpisodesRecognized = useMemo(() => {
    if (!plan || plan.files.length === 0 || !mediaMetadata) {
      return false
    }
    return !isRuleBasedRecognizePlanComplete(plan.files, mediaMetadata)
  }, [plan, mediaMetadata])

  const allPlanFilesUnchanged = useMemo(() => {
    if (!plan || plan.files.length === 0 || !mediaMetadata) {
      return false
    }
    return isRuleBasedRecognizePlanFullyUnchanged(plan.files, mediaMetadata)
  }, [plan, mediaMetadata])

  const isConfirmButtonDisabled = loading || allPlanFilesUnchanged

  return {
    plan,
    open,
    loading,
    tvShowTitle,
    tvShowTmdbId,
    notAllEpisodesRecognized,
    allPlanFilesUnchanged,
    isConfirmButtonDisabled,
    confirm,
    cancel,
    start,
  }
}
