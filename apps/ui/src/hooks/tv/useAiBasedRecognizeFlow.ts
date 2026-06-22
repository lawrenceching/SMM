import { useCallback, useEffect, useMemo } from "react"
import { toast } from "sonner"
import { handleAiRecognizeConfirm } from "@/actions/handleAiRecognizeConfirm"
import { cleanupRecognizePlan } from "@/ai/tools/EndRecognizeTask"
import { selectActiveAiPlan } from "@/components/tv/plans/selectActiveAppPlan"
import { useFeatures } from "@/hooks/useFeatures"
import { toUpdatePlanPatch, useUpdatePlanMutation } from "@/hooks/plans"
import { useUpdateMediaMetadataMutation } from "@/hooks/mediaMetadata/useUpdateMediaMetadataMutation"
import type { MediaMetadata } from "@core/types"
import type { RecognizeMediaFilePlan } from "@core/types/RecognizeMediaFilePlan"
import type { UIPlan } from "@/types/UIPlan"
import type { UIRecognizeMediaFilePlan } from "@/types/UIRecognizeMediaFilePlan"

export interface UseAiBasedRecognizeFlowOptions {
  plans: UIPlan[]
  mediaMetadata: MediaMetadata | undefined
  beforeConfirm: (plan: UIRecognizeMediaFilePlan) => UIRecognizeMediaFilePlan
  /** Called when an AI recognize plan is detected (e.g. switch episode table to simple layout). */
  onFlowStart?: () => void
}

/**
 * Surfaces AI/MCP-created recognize plans for preview mode and
 * AiBasedRecognizePrompt. Rule-based (creator: 'app') plans are handled
 * exclusively by useRuleBasedRecognizeFlow.
 */
export function useAiBasedRecognizeFlow({
  plans,
  mediaMetadata,
  beforeConfirm,
  onFlowStart,
}: UseAiBasedRecognizeFlowOptions) {
  const { isAiFeatureEnabled } = useFeatures()
  const updatePlanMutation = useUpdatePlanMutation()
  const { persistMediaMetadata } = useUpdateMediaMetadataMutation()
  const mediaFolderPath = mediaMetadata?.mediaFolderPath

  const plan = useMemo(
    () =>
      isAiFeatureEnabled
        ? selectActiveAiPlan<UIRecognizeMediaFilePlan>(
            plans,
            mediaFolderPath,
            "recognize-media-file",
          )
        : undefined,
    [isAiFeatureEnabled, plans, mediaFolderPath],
  )

  const promptStatus: "generating" | "wait-for-ack" =
    plan?.status === "preparing" ? "generating" : "wait-for-ack"

  const onConfirm = useCallback(async () => {
    if (!plan || !mediaMetadata?.mediaFolderPath) return
    const preparedPlan = beforeConfirm(plan) as RecognizeMediaFilePlan
    await handleAiRecognizeConfirm(
      preparedPlan,
      mediaMetadata,
      persistMediaMetadata,
      async (id, patch) => {
        await updatePlanMutation.mutateAsync({
          id,
          mediaFolderPath: mediaMetadata.mediaFolderPath!,
          patch: toUpdatePlanPatch(patch),
        })
      },
    )
    await cleanupRecognizePlan(plan.id)
  }, [
    plan,
    mediaMetadata,
    beforeConfirm,
    persistMediaMetadata,
    updatePlanMutation,
  ])

  const onCancel = useCallback(async () => {
    if (!plan || !mediaFolderPath) return
    try {
      await updatePlanMutation.mutateAsync({
        id: plan.id,
        mediaFolderPath,
        patch: toUpdatePlanPatch({ status: "rejected" }),
      })
      await cleanupRecognizePlan(plan.id)
    } catch (error) {
      console.error("[useAiBasedRecognizeFlow] Error rejecting recognize plan:", error)
      toast.error(
        `Failed to reject recognize plan: ${error instanceof Error ? error.message : "Unknown error"}`,
      )
    }
  }, [plan, mediaFolderPath, updatePlanMutation])

  useEffect(() => {
    if (plan) {
      onFlowStart?.()
    }
  }, [plan?.id, onFlowStart])

  return {
    plan,
    promptStatus,
    onConfirm,
    onCancel,
  }
}
