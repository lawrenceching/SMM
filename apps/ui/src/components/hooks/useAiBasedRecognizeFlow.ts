import { useCallback, useEffect } from "react"
import { toast } from "sonner"
import { handleAiRecognizeConfirm } from "@/actions/handleAiRecognizeConfirm"
import { cleanupRecognizePlan } from "@/ai/tools/EndRecognizeTask"
import { handlePendingPlans } from "@/components/TvShowPanelUtils"
import { useFeatures } from "@/hooks/useFeatures"
import { toUpdatePlanPatch, useUpdatePlanMutation } from "@/hooks/plans"
import { useTvShowPromptsStore } from "@/stores/tvShowPromptsStore"
import type { RecognizeMediaFilePlan } from "@core/types/RecognizeMediaFilePlan"
import type { UIPlan } from "@/types/UIPlan"
import type { UIMediaMetadata } from "@/types/UIMediaMetadata"
import type { PersistUIMediaMetadataFn } from "@/types/persistUIMediaMetadata"

export interface UseAiBasedRecognizeFlowOptions {
  /** Active plan for the folder (renameFlow.plan ?? recognizeFlow.plan). */
  activePlan: UIPlan | undefined
  mediaMetadata: UIMediaMetadata | undefined
  persistUiMediaMetadata: PersistUIMediaMetadataFn
}

/**
 * Surfaces AI/MCP-created recognize plans via AiBasedRecognizePrompt.
 * Rule-based (creator: 'app') recognize plans are handled exclusively by
 * RuleBasedRecognizePrompt and must never trigger the AI prompt here.
 */
export function useAiBasedRecognizeFlow({
  activePlan,
  mediaMetadata,
  persistUiMediaMetadata,
}: UseAiBasedRecognizeFlowOptions) {
  const { isAiFeatureEnabled } = useFeatures()
  const updatePlanMutation = useUpdatePlanMutation()

  const openAiBasedRecognizePrompt = useTvShowPromptsStore(
    (state) => state.openAiBasedRecognizePrompt,
  )
  const closeAiBasedRecognizePrompt = useTvShowPromptsStore(
    (state) => state.closeAiBasedRecognizePrompt,
  )

  const handleAiRecognizeConfirmCallback = useCallback(
    async (plan: RecognizeMediaFilePlan) => {
      if (!isAiFeatureEnabled || !mediaMetadata?.mediaFolderPath) return
      await handleAiRecognizeConfirm(plan, mediaMetadata, persistUiMediaMetadata, async (id, patch) => {
        await updatePlanMutation.mutateAsync({
          id,
          mediaFolderPath: mediaMetadata.mediaFolderPath!,
          patch: toUpdatePlanPatch(patch),
        })
      })
      await cleanupRecognizePlan(plan.id)
    },
    [isAiFeatureEnabled, mediaMetadata, persistUiMediaMetadata, updatePlanMutation],
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
