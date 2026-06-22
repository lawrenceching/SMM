import { useCallback, useEffect, useMemo } from "react"
import { toast } from "sonner"
import { cleanupRenamePlan } from "@/ai/tools/EndRenameFilesTask"
import { selectActiveAiPlan } from "@/components/tv/plans/selectActiveAppPlan"
import { useTvShowWebSocketEvents } from "./useTvShowWebSocketEvents"
import { useFeatures } from "@/hooks/useFeatures"
import { toUpdatePlanPatch, useUpdatePlanMutation } from "@/hooks/plans"
import type { MediaMetadata } from "@core/types"
import type { UIPlan } from "@/types/UIPlan"
import type { UIRenameFilesPlan } from "@/types/UIRenameFilesPlan"

export interface UseAiBasedRenameFilesFlowOptions {
  plans: UIPlan[]
  mediaMetadata: MediaMetadata | undefined
  onAppRenameConfirm: (planId: string) => Promise<void>
  setSelectedMediaMetadataByMediaFolderPath: (path: string) => void
  /** Called when an AI rename plan is detected (e.g. switch episode table to simple layout). */
  onFlowStart?: () => void
}

/**
 * Surfaces AI/MCP-created rename plans for preview mode and
 * AiBasedRenameFilePrompt. Rule-based (creator: 'app') plans are handled
 * exclusively by useRuleBasedRenameFilesFlow.
 */
export function useAiBasedRenameFilesFlow({
  plans,
  mediaMetadata,
  onAppRenameConfirm,
  setSelectedMediaMetadataByMediaFolderPath,
  onFlowStart,
}: UseAiBasedRenameFilesFlowOptions) {
  const { isAiFeatureEnabled } = useFeatures()
  const updatePlanMutation = useUpdatePlanMutation()
  const mediaFolderPath = mediaMetadata?.mediaFolderPath

  const plan = useMemo(
    () =>
      isAiFeatureEnabled
        ? selectActiveAiPlan<UIRenameFilesPlan>(
            plans,
            mediaFolderPath,
            "rename-files",
          )
        : undefined,
    [isAiFeatureEnabled, plans, mediaFolderPath],
  )

  const promptStatus: "generating" | "wait-for-ack" =
    plan?.status === "preparing" ? "generating" : "wait-for-ack"

  const onConfirm = useCallback(async () => {
    if (!plan) return
    await onAppRenameConfirm(plan.id)
  }, [plan, onAppRenameConfirm])

  const onCancel = useCallback(async () => {
    if (!plan || !mediaFolderPath) return
    try {
      await updatePlanMutation.mutateAsync({
        id: plan.id,
        mediaFolderPath,
        patch: toUpdatePlanPatch({ status: "rejected" }),
      })
      await cleanupRenamePlan(plan.id)
    } catch (error) {
      console.error("[useAiBasedRenameFilesFlow] Error rejecting rename plan:", error)
      toast.error(
        `Failed to reject rename plan: ${error instanceof Error ? error.message : "Unknown error"}`,
      )
    }
  }, [plan, mediaFolderPath, updatePlanMutation])

  useEffect(() => {
    if (plan) {
      onFlowStart?.()
    }
  }, [plan?.id, onFlowStart])

  useTvShowWebSocketEvents({
    setSelectedMediaMetadataByMediaFolderPath,
  })

  return {
    plan,
    promptStatus,
    onConfirm,
    onCancel,
  }
}
