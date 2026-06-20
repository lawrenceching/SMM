import { useCallback, useMemo, useRef } from "react"
import { toast } from "sonner"
import {
  applyRecognizeMediaFilePlan,
  buildTemporaryRecognitionPlanAsync,
  rebuildPlanWithSelectedEpisodes,
} from "@/components/TvShowPanelUtils"
import { selectActiveAppPlan } from "@/components/plans/selectActiveAppPlan"
import { useCreatePlanMutation, toUpdatePlanPatch, useUpdatePlanMutation } from "@/hooks/plans"
import { useOnFirstOpen } from "@/hooks/useOnFirstOpen"
import {
  isRuleBasedRecognizePlanComplete,
  isRuleBasedRecognizePlanFullyUnchanged,
} from "@/lib/isRuleBasedRecognizePlanComplete"
import { nextTraceId } from "@/lib/utils"
import type { MediaMetadata } from "@core/types"
import type { RecognizeMediaFilePlan } from "@core/types/RecognizeMediaFilePlan"
import type { UIPlan } from "@/types/UIPlan"
import type { UIMediaMetadata } from "@/types/UIMediaMetadata"
import type { UIRecognizeMediaFilePlan } from "@/types/UIRecognizeMediaFilePlan"
import type { PersistUIMediaMetadataFn } from "@/types/persistUIMediaMetadata"

export interface SelectedEpisode {
  season: number
  episode: number
}

export interface UseRuleBasedRecognizeFlowOptions {
  plans: UIPlan[]
  mediaMetadata: UIMediaMetadata | undefined
  getSelectedEpisodes: () => SelectedEpisode[]
  persistUiMediaMetadata: PersistUIMediaMetadataFn
  t: (key: string, options?: Record<string, unknown>) => string
}

export function useRuleBasedRecognizeFlow({
  plans,
  mediaMetadata,
  getSelectedEpisodes,
  persistUiMediaMetadata,
  t,
}: UseRuleBasedRecognizeFlowOptions) {
  const mediaFolderPath = mediaMetadata?.mediaFolderPath
  const createPlanMutation = useCreatePlanMutation()
  const updatePlanMutation = useUpdatePlanMutation()
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
      if (!mediaMetadata) {
        toast.error("No media metadata available")
        return
      }

      if (!recognizePlan.mediaFolderPath) {
        toast.error("Plan not found or invalid")
        return
      }

      try {
        const actualPlan = rebuildPlanWithSelectedEpisodes(
          recognizePlan as RecognizeMediaFilePlan,
          getSelectedEpisodes(),
        )
        const traceId = `TvShowPanel-handleRuleBasedRecognizeConfirm-${nextTraceId()}`
        await applyRecognizeMediaFilePlan(actualPlan, mediaMetadata, persistUiMediaMetadata, {
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
    [mediaMetadata, mediaFolderPath, getSelectedEpisodes, persistUiMediaMetadata, updatePlanMutation, t],
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
