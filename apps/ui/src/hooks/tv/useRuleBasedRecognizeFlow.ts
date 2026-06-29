import { useCallback, useEffect, useMemo, useRef } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  applyRecognizeMediaFilePlan,
  buildTemporaryRecognitionPlanAsync,
} from "@/components/tv/TvShowPanelUtils"
import { selectActiveAppPlan } from "@/components/tv/plans/selectActiveAppPlan"
import { useCreatePlanMutation, toUpdatePlanPatch, useUpdatePlanMutation } from "@/hooks/plans"
import { plansQueryKey } from "@/hooks/plans/plansQueryKeys"
import { useUpdateMediaMetadataMutation } from "@/hooks/mediaMetadata/useUpdateMediaMetadataMutation"
import {
  isRuleBasedRecognizePlanComplete,
  isRuleBasedRecognizePlanFullyUnchanged,
} from "@/lib/isRuleBasedRecognizePlanComplete"
import { normalizeMediaFolderPathForQuery } from "@/lib/mediaMetadataQueryKeys"
import { nextTraceId } from "@/lib/utils"
import { useTranslation } from "@/lib/i18n"
import type { Plan } from "@/api/getPlans"
import type { MediaMetadata } from "@core/types"
import type { RecognizeMediaFilePlan } from "@core/types/RecognizeMediaFilePlan"
import type { UIMediaFolderStatus } from "@/types/UIMediaFolder"
import type { UIPlan } from "@/types/UIPlan"
import type { UIRecognizeMediaFilePlan } from "@/types/UIRecognizeMediaFilePlan"

export interface UseRuleBasedRecognizeFlowOptions {
  plans: UIPlan[]
  mediaMetadata: MediaMetadata | undefined
  uiStatus: UIMediaFolderStatus | undefined
  beforeConfirm: (plan: UIRecognizeMediaFilePlan) => UIRecognizeMediaFilePlan
}

export function useRuleBasedRecognizeFlow({
  plans,
  mediaMetadata,
  uiStatus,
  beforeConfirm,
}: UseRuleBasedRecognizeFlowOptions) {
  const { t } = useTranslation(["components"])
  const queryClient = useQueryClient()
  const mediaFolderPath = mediaMetadata?.mediaFolderPath
  const createPlanMutation = useCreatePlanMutation()
  const updatePlanMutation = useUpdatePlanMutation()
  const { persistMediaMetadata } = useUpdateMediaMetadataMutation()
  const computationRef = useRef(new Set<string>())

  const recognizeFailedMessage = t("toast.recognizeFailed", {
    defaultValue: "Recognition failed. Please try again.",
  })
  const noRecognizedFilesMessage = t("toast.noRecognizedFiles", {
    defaultValue:
      "Unable to recognize any episodes. Consider using AI to recognize instead.",
  })

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
    uiStatus === "ok" ? mediaMetadata : undefined

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

  const removePlanFromCache = useCallback(
    (planId: string) => {
      if (!mediaFolderPath) return
      console.log("[recognize] remove plan from cache", { planId, mediaFolderPath })
      const key = plansQueryKey(normalizeMediaFolderPathForQuery(mediaFolderPath))
      queryClient.setQueryData<Plan[]>(key, (prev) =>
        (prev ?? []).filter((p) => p.id !== planId),
      )
    },
    [mediaFolderPath, queryClient],
  )

  const failRecognizePlan = useCallback(
    async (planId: string, message: string, reason: string) => {
      console.warn("[recognize] fail recognize plan", { planId, reason, message })
      toast.error(message)
      if (!mediaFolderPath) {
        removePlanFromCache(planId)
        return
      }
      try {
        await updatePlanMutation.mutateAsync({
          id: planId,
          mediaFolderPath,
          patch: toUpdatePlanPatch({ status: "rejected" }),
        })
        console.log("[recognize] plan rejected", { planId })
      } catch (error) {
        console.error("[recognize] failed to reject plan, removing from cache", { planId, error })
        removePlanFromCache(planId)
      }
    },
    [mediaFolderPath, updatePlanMutation, removePlanFromCache],
  )

  const resumeComputation = useCallback(
    (planId: string) => {
      if (!mediaFolderPath || !mediaMetadata) {
        return
      }

      const current = plans.find((p) => p.id === planId)
      if (
        !current ||
        current.task !== "recognize-media-file" ||
        current.status !== "preparing" ||
        current.files.length > 0
      ) {
        return
      }
      if (computationRef.current.has(planId)) {
        return
      }
      computationRef.current.add(planId)
      console.log("[recognize] matching episode video files by naming rules", {
        planId,
        mediaFolderPath,
        tvShow: mediaMetadata.tvShow?.name,
      })

      void buildTemporaryRecognitionPlanAsync(mediaMetadata)
        .then(async (planData) => {
          if (planData && planData.files.length > 0) {
            await updatePlanMutation.mutateAsync({
              id: planId,
              mediaFolderPath,
              patch: toUpdatePlanPatch({ status: "pending", files: planData.files }),
            })
            console.log("[recognize] recognize preview ready — user can review and confirm", {
              planId,
              tvShow: mediaMetadata.tvShow?.name,
              matchedCount: planData.files.length,
              matches: planData.files.map((f) => ({
                episode: `S${f.season}E${f.episode}`,
                file: f.path.split(/[/\\]/).pop(),
              })),
            })
            return
          }
          await failRecognizePlan(planId, noRecognizedFilesMessage, "no recognized files")
        })
        .catch(async (err) => {
          console.error("[recognize] episode matching failed", { planId, error: err })
          const message =
            err instanceof Error && err.message ? err.message : recognizeFailedMessage
          await failRecognizePlan(planId, message, "computation error")
        })
        .finally(() => {
          computationRef.current.delete(planId)
        })
    },
    [
      mediaFolderPath,
      mediaMetadata,
      plans,
      updatePlanMutation,
      failRecognizePlan,
      noRecognizedFilesMessage,
      recognizeFailedMessage,
    ],
  )

  const onConfirm = useCallback(
    async (recognizePlan: UIRecognizeMediaFilePlan) => {
      console.log("[recognize] confirm started", {
        planId: recognizePlan.id,
        fileCount: recognizePlan.files.length,
      })

      if (!okMediaMetadata) {
        console.warn("[recognize] confirm aborted: no media metadata", { planId: recognizePlan.id })
        toast.error("No media metadata available")
        return
      }

      if (!recognizePlan.mediaFolderPath) {
        console.warn("[recognize] confirm aborted: invalid plan", { planId: recognizePlan.id })
        toast.error("Plan not found or invalid")
        return
      }

      try {
        const actualPlan = beforeConfirm(recognizePlan) as RecognizeMediaFilePlan
        const traceId = `TvShowPanel-handleRuleBasedRecognizeConfirm-${nextTraceId()}`
        console.log("[recognize] applying recognize plan", {
          planId: recognizePlan.id,
          traceId,
          fileCount: actualPlan.files.length,
        })
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
        console.log("[recognize] confirm completed", { planId: recognizePlan.id, traceId })
        toast.success(t("toolbar.recognizeEpisodesSuccess"))
      } catch (error) {
        console.error("[recognize] confirm failed", { planId: recognizePlan.id, error })
        toast.error("Failed to apply recognition")
      }
    },
    [okMediaMetadata, mediaFolderPath, beforeConfirm, persistMediaMetadata, updatePlanMutation, t],
  )

  const onCancel = useCallback(
    async (planId: string) => {
      console.log("[recognize] cancel started", { planId })
      if (!mediaFolderPath) {
        console.warn("[recognize] cancel aborted: no media folder path", { planId })
        return
      }
      try {
        await updatePlanMutation.mutateAsync({
          id: planId,
          mediaFolderPath,
          patch: toUpdatePlanPatch({ status: "rejected" }),
        })
        console.log("[recognize] cancel completed", { planId })
      } catch (error) {
        console.error("[recognize] cancel failed, removing from cache", { planId, error })
        removePlanFromCache(planId)
        toast.error(recognizeFailedMessage)
      }
    },
    [mediaFolderPath, updatePlanMutation, removePlanFromCache, recognizeFailedMessage],
  )

  const startRecognizeFlow = useCallback(() => {
    if (!mediaFolderPath) {
      console.warn("[recognize] start aborted: no media folder path")
      toast.error("No media folder path available")
      return
    }

    const planId = crypto.randomUUID()
    console.log("[recognize] user started rule-based recognize", {
      planId,
      mediaFolderPath,
      tvShow: mediaMetadata?.tvShow?.name,
    })

    void createPlanMutation
      .createPlanOptimistic({
        id: planId,
        task: "recognize-media-file",
        mediaFolderPath,
        creator: "app",
      })
      .then(() => {
        console.log("[recognize] recognize plan created (status=preparing), matching files next", {
          planId,
        })
      })
      .catch(async (err) => {
        console.error("[recognize] failed to create plan", { planId, error: err })
        const message =
          err instanceof Error && err.message ? err.message : recognizeFailedMessage
        toast.error(message)
        removePlanFromCache(planId)
      })
  }, [
    mediaFolderPath,
    createPlanMutation,
    recognizeFailedMessage,
    removePlanFromCache,
  ])

  useEffect(() => {
    if (
      plan?.status === "preparing" &&
      plan.files.length === 0 &&
      mediaMetadata &&
      mediaFolderPath
    ) {
      resumeComputation(plan.id)
    }
  }, [plan?.id, plan?.status, plan?.files.length, mediaMetadata, mediaFolderPath, resumeComputation])

  useEffect(() => {
    if (plan?.status === "preparing" && uiStatus === "error_loading_metadata") {
      console.warn("[recognize] metadata load error while preparing, failing plan", { planId: plan.id })
      void failRecognizePlan(plan.id, recognizeFailedMessage, "metadata load error")
    }
  }, [plan?.id, plan?.status, uiStatus, failRecognizePlan, recognizeFailedMessage])

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
