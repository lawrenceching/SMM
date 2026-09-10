import { useCallback, useEffect, useMemo } from "react"
import { toast } from "sonner"
import { selectActiveAiPlan } from "@/components/tv/plans/selectActiveAppPlan"
import { useTvShowWebSocketEvents } from "./useTvShowWebSocketEvents"
import {
  toUpdatePlanPatch,
  useApplyPlanMutation,
  usePlansPullOnVisible,
  usePlansQuery,
  useUpdatePlanMutation,
} from "@/hooks/plans"
import { useUIMediaFolderStore } from "@/stores/uiMediaFolderStore"
import type { MediaMetadata } from "@smm/types"
import type { UIRenameFilesPlan } from "@/types/UIRenameFilesPlan"
import type { AiBasedRenameEpisodePromptProps } from "@/components/tv/AiBasedRenameEpisodePrompt"

export interface UseAiBasedRenameEpisodeFlowOptions {
  mediaMetadata: MediaMetadata | undefined
  /** Called when an AI rename plan is detected (e.g. switch episode table to simple layout). */
  onFlowStart?: () => void
}

/**
 * Cohesive AI-based rename episode flow: surfaces AI/MCP-created rename plans
 * for the selected folder and drives AiBasedRenameEpisodePrompt. Plans query,
 * folder selection and confirm/cancel side effects live in this hook — the
 * panel only renders promptProps. Rule-based (creator: 'app') plans are
 * handled exclusively by useRuleBasedRenameFilesFlow.
 *
 * Not gated by `isAiFeatureEnabled` — see useAiBasedRecognizeEpisodeFlow.
 */
export function useAiBasedRenameEpisodeFlow({
  mediaMetadata,
  onFlowStart,
}: UseAiBasedRenameEpisodeFlowOptions) {
  const { data: plans = [] } = usePlansQuery(mediaMetadata?.mediaFolderPath)
  const updatePlanMutation = useUpdatePlanMutation()
  const applyPlanMutation = useApplyPlanMutation()
  const mediaFolderPath = mediaMetadata?.mediaFolderPath

  const plan = useMemo(
    () =>
      selectActiveAiPlan<UIRenameFilesPlan>(
        plans,
        mediaFolderPath,
        "rename-files",
      ),
    [plans, mediaFolderPath],
  )

  useEffect(() => {
    console.log(
      `[rename] useAiBasedRenameEpisodeFlow: plan=${plan ? `id=${plan.id} status=${plan.status}` : "undefined"}, ` +
      `mediaFolderPath=${mediaFolderPath}, plansCount=${plans.length}`,
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan?.id, plan?.status, plans.length, mediaFolderPath])

  // Applies the pending plan via POST /api/apply-plan (AI rename approval in
  // docs/dev/rename-episodes.md). useApplyPlanMutation removes the plan from
  // the plans cache on success, which closes the prompt.
  const onConfirm = useCallback(async () => {
    if (!plan || !mediaFolderPath) return
    try {
      await applyPlanMutation.mutateAsync({ id: plan.id, mediaFolderPath })
    } catch (error) {
      console.error("[useAiBasedRenameEpisodeFlow] Error applying rename plan:", error)
      toast.error(
        `Failed to apply rename plan: ${error instanceof Error ? error.message : "Unknown error"}`,
      )
    }
  }, [plan, mediaFolderPath, applyPlanMutation])

  const onCancel = useCallback(async () => {
    if (!plan || !mediaFolderPath) return
    try {
      await updatePlanMutation.mutateAsync({
        id: plan.id,
        mediaFolderPath,
        patch: toUpdatePlanPatch({ status: "rejected" }),
      })
    } catch (error) {
      console.error("[useAiBasedRenameEpisodeFlow] Error rejecting rename plan:", error)
      toast.error(
        `Failed to reject rename plan: ${error instanceof Error ? error.message : "Unknown error"}`,
      )
    }
  }, [plan, mediaFolderPath, updatePlanMutation])

  useEffect(() => {
    if (plan) {
      onFlowStart?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan?.id, onFlowStart])

  const setSelectedMediaMetadataByMediaFolderPath = useCallback((path: string) => {
    useUIMediaFolderStore.getState().applyFolderClick(path, false)
  }, [])

  useTvShowWebSocketEvents({
    setSelectedMediaMetadataByMediaFolderPath,
  })

  usePlansPullOnVisible()

  const promptProps = useMemo((): AiBasedRenameEpisodePromptProps => ({
    isOpen: plan !== undefined,
    onConfirm: () => {
      void onConfirm()
    },
    onCancel: () => {
      void onCancel()
    },
  }), [plan, onConfirm, onCancel])

  return {
    plan,
    onConfirm,
    onCancel,
    promptProps,
  }
}
