import { useCallback, useMemo, useRef } from "react"
import { toast } from "sonner"
import {
  applyRecognizeMediaFilePlan,
  buildTemporaryRecognitionPlanAsync,
} from "@/components/TvShowPanelUtils"
import { selectActiveAppPlan } from "@/components/plans/selectActiveAppPlan"
import { useCreatePlanMutation, toUpdatePlanPatch, useUpdatePlanMutation } from "@/hooks/plans"
import { useUpdateMediaMetadataMutation } from "@/hooks/mediaMetadata/useUpdateMediaMetadataMutation"
import { useOnFirstOpen } from "@/hooks/useOnFirstOpen"
import {
  isRuleBasedRecognizePlanComplete,
  isRuleBasedRecognizePlanFullyUnchanged,
} from "@/lib/isRuleBasedRecognizePlanComplete"
import { nextTraceId } from "@/lib/utils"
import { useTranslation } from "@/lib/i18n"
import type { MediaMetadata } from "@core/types"
import type { RecognizeMediaFilePlan } from "@core/types/RecognizeMediaFilePlan"
import type { UIPlan } from "@/types/UIPlan"
import type { UIMediaMetadata } from "@/types/UIMediaMetadata"
import type { UIRecognizeMediaFilePlan } from "@/types/UIRecognizeMediaFilePlan"

export interface UseRuleBasedRecognizeFlowOptions {
  plans: UIPlan[]
  mediaMetadata: UIMediaMetadata | undefined
  beforeConfirm: (plan: UIRecognizeMediaFilePlan) => UIRecognizeMediaFilePlan
}

export function useRuleBasedRecognizeFlow({
  plans,
  mediaMetadata,
  beforeConfirm,
}: UseRuleBasedRecognizeFlowOptions) {
  const { t } = useTranslation(["components"])
  const mediaFolderPath = mediaMetadata?.mediaFolderPath
  const createPlanMutation = useCreatePlanMutation()
  const updatePlanMutation = useUpdatePlanMutation()
  const { persistMediaMetadata } = useUpdateMediaMetadataMutation()
  const computationRef = useRef(new Set<string>())

  const plan = useMemo(
    () =>
      selectActiveAppPlan<UIRecognizeMediaFilePlan>(
        plans,
        mediaFolderPath,
        "recognize-media-file",
      ),
    [plans, mediaFolderPath],
  )

  const open = plan !== undefined
  const loading = plan?.status === "preparing"

  const tvShowTitle = mediaMetadata?.tvShow?.name ?? ""
  const tvShowTmdbId = parseInt(mediaMetadata?.tvShow?.id ?? "0", 10)

  const okMediaMetadata =
    mediaMetadata?.status === "ok" ? (mediaMetadata as MediaMetadata) : undefined

  const notAllEpisodesRecognized = useMemo(() => {
    if (
      loading ||
      !plan ||
      plan.status !== "pending" ||
      plan.task !== "recognize-media-file" ||
      !okMediaMetadata
    ) {
      return false
    }
    return !isRuleBasedRecognizePlanComplete(plan.files, okMediaMetadata)
  }, [loading, plan, okMediaMetadata])

  const allPlanFilesUnchanged = useMemo(() => {
    if (
      loading ||
      !plan ||
      plan.status !== "pending" ||
      plan.task !== "recognize-media-file" ||
      !okMediaMetadata
    ) {
      return false
    }
    return isRuleBasedRecognizePlanFullyUnchanged(plan.files, okMediaMetadata)
  }, [loading, plan, okMediaMetadata])

  const resumeComputation = useCallback(
    (planId: string) => {
      if (!mediaFolderPath || !mediaMetadata) return

      const current = plans.find((p) => p.id === planId)
      if (
        !current ||
        current.task !== "recognize-media-file" ||
        current.status !== "preparing" ||
        current.files.length > 0
      ) {
        return
      }
      if (computationRef.current.has(planId)) return
      computationRef.current.add(planId)

      void buildTemporaryRecognitionPlanAsync(mediaMetadata)
        .then((planData) => {
          if (planData && planData.files.length > 0) {
            return updatePlanMutation.mutateAsync({
              id: planId,
              mediaFolderPath,
              patch: toUpdatePlanPatch({ status: "pending", files: planData.files }),
            })
          }
          toast.error(
            t("toast.noRecognizedFiles", {
              defaultValue:
                "Unable to recognize any episodes. Consider using AI to recognize instead.",
            }),
          )
          return updatePlanMutation.mutateAsync({
            id: planId,
            mediaFolderPath,
            patch: toUpdatePlanPatch({ status: "rejected" }),
          })
        })
        .catch((err) => {
          void updatePlanMutation.mutateAsync({
            id: planId,
            mediaFolderPath,
            patch: toUpdatePlanPatch({ status: "rejected" }),
          })
          toast.error(err instanceof Error ? err.message : "Recognition failed")
        })
        .finally(() => {
          computationRef.current.delete(planId)
        })
    },
    [mediaFolderPath, mediaMetadata, plans, updatePlanMutation, t],
  )

  const onConfirm = useCallback(
    async (recognizePlan: UIRecognizeMediaFilePlan) => {
      if (!okMediaMetadata) {
        toast.error("No media metadata available")
        return
      }

      if (!recognizePlan.mediaFolderPath) {
        toast.error("Plan not found or invalid")
        return
      }

      try {
        const actualPlan = beforeConfirm(recognizePlan) as RecognizeMediaFilePlan
        const traceId = `TvShowPanel-handleRuleBasedRecognizeConfirm-${nextTraceId()}`
        await applyRecognizeMediaFilePlan(actualPlan, okMediaMetadata, persistMediaMetadata, {
          traceId,
        })
        if (mediaFolderPath) {
          await updatePlanMutation.mutateAsync({
            id: recognizePlan.id,
            mediaFolderPath,
            patch: toUpdatePlanPatch({ status: "completed" }),
          })
        }
        toast.success(t("toolbar.recognizeEpisodesSuccess"))
      } catch (error) {
        console.error("[useRuleBasedRecognizeFlow] Error applying rule-based recognition:", error)
        toast.error("Failed to apply recognition")
      }
    },
    [okMediaMetadata, mediaFolderPath, beforeConfirm, persistMediaMetadata, updatePlanMutation, t],
  )

  const onCancel = useCallback(
    async (planId: string) => {
      if (!mediaFolderPath) return
      await updatePlanMutation.mutateAsync({
        id: planId,
        mediaFolderPath,
        patch: toUpdatePlanPatch({ status: "rejected" }),
      })
    },
    [mediaFolderPath, updatePlanMutation],
  )

  const startRecognizeFlow = useCallback(() => {
    if (!mediaFolderPath) {
      toast.error("No media folder path available")
      return
    }

    const planId = crypto.randomUUID()

    void createPlanMutation
      .createPlanOptimistic({
        id: planId,
        task: "recognize-media-file",
        mediaFolderPath,
        creator: "app",
      })
      .then(() => {
        resumeComputation(planId)
      })
  }, [mediaFolderPath, createPlanMutation, resumeComputation])

  useOnFirstOpen(
    () => {
      if (plan) {
        resumeComputation(plan.id)
      }
    },
    open && plan?.status === "preparing" && plan.files.length === 0,
    [plan?.id, resumeComputation],
  )

  return {
    plan,
    open,
    loading,
    tvShowTitle,
    tvShowTmdbId,
    notAllEpisodesRecognized,
    allPlanFilesUnchanged,
    onConfirm,
    onCancel,
    startRecognizeFlow,
  }
}
