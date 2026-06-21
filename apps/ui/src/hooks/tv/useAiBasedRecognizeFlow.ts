import { useCallback, useEffect } from "react"
import { toast } from "sonner"
import { handleAiRecognizeConfirm } from "@/actions/handleAiRecognizeConfirm"
import { cleanupRecognizePlan } from "@/ai/tools/EndRecognizeTask"
import { handlePendingPlans } from "@/components/tv/TvShowPanelUtils"
import { useFeatures } from "@/hooks/useFeatures"
import { toUpdatePlanPatch, useUpdatePlanMutation } from "@/hooks/plans"
import { useUpdateMediaMetadataMutation } from "@/hooks/mediaMetadata/useUpdateMediaMetadataMutation"
import { useTvShowPromptsStore } from "@/stores/tvShowPromptsStore"
import type { MediaMetadata } from "@core/types"
import type { RecognizeMediaFilePlan } from "@core/types/RecognizeMediaFilePlan"
import type { UIPlan } from "@/types/UIPlan"

export interface UseAiBasedRecognizeFlowOptions {
  /** Active plan for the folder (renameFlow.plan ?? recognizeFlow.plan). */
  activePlan: UIPlan | undefined
  mediaMetadata: MediaMetadata | undefined
}

/**
 * Surfaces AI/MCP-created recognize plans via AiBasedRecognizePrompt.
 * Rule-based (creator: 'app') recognize plans are handled exclusively by
 * RuleBasedRecognizePrompt and must never trigger the AI prompt here.
 */
export function useAiBasedRecognizeFlow({
  activePlan,
  mediaMetadata,
}: UseAiBasedRecognizeFlowOptions) {
  const { isAiFeatureEnabled } = useFeatures()
  const updatePlanMutation = useUpdatePlanMutation()
  const { persistMediaMetadata } = useUpdateMediaMetadataMutation()

  const openAiBasedRecognizePrompt = useTvShowPromptsStore(
    (state) => state.openAiBasedRecognizePrompt,
  )
  const closeAiBasedRecognizePrompt = useTvShowPromptsStore(
    (state) => state.closeAiBasedRecognizePrompt,
  )

  const handleAiRecognizeConfirmCallback = useCallback(
    async (plan: RecognizeMediaFilePlan) => {
      if (!isAiFeatureEnabled || !mediaMetadata?.mediaFolderPath) return
      await handleAiRecognizeConfirm(plan, mediaMetadata, persistMediaMetadata, async (id, patch) => {
        await updatePlanMutation.mutateAsync({
          id,
          mediaFolderPath: mediaMetadata.mediaFolderPath!,
          patch: toUpdatePlanPatch(patch),
        })
      })
      await cleanupRecognizePlan(plan.id)
    },
    [isAiFeatureEnabled, mediaMetadata, persistMediaMetadata, updatePlanMutation],
  )

  useEffect(() => {
    if (activePlan === undefined) {
      closeAiBasedRecognizePrompt()
      return
    }

    if (activePlan.status !== "pending") {
      return
    }

    if (activePlan.task === "recognize-media-file" && activePlan.creator === "app") {
      return
    }

    console.log(`[useAiBasedRecognizeFlow] handlePendingPlans:`, structuredClone(activePlan))
    handlePendingPlans({
      pendingPlans: [activePlan],
      mediaMetadata,
      openAiBasedRecognizePrompt,
      closeAiBasedRecognizePrompt,
      handleAiRecognizeConfirmCallback,
      updatePlan: async (planId, status) => {
        if (!mediaMetadata?.mediaFolderPath) return
        await updatePlanMutation.mutateAsync({
          id: planId,
          mediaFolderPath: mediaMetadata.mediaFolderPath,
          patch: { status },
        })
      },
      toast,
      isAiFeatureEnabled,
    })
  }, [
    activePlan,
    mediaMetadata,
    isAiFeatureEnabled,
    openAiBasedRecognizePrompt,
    closeAiBasedRecognizePrompt,
    handleAiRecognizeConfirmCallback,
    updatePlanMutation,
  ])
}
