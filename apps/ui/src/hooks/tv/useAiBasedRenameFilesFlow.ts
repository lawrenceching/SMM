import { useCallback, useEffect, useMemo } from "react"
import { toast } from "sonner"
import { cleanupRenamePlan } from "@/ai/plan/cleanupRenamePlan"
import { selectActiveAiPlan } from "@/components/tv/plans/selectActiveAppPlan"
import { useTvShowWebSocketEvents } from "./useTvShowWebSocketEvents"
import { toUpdatePlanPatch, useUpdatePlanMutation } from "@/hooks/plans"
import type { MediaMetadata } from "@smm/types"
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
 *
 * Not gated by `isAiFeatureEnabled` — see useAiBasedRecognizeFlow.
 */
export function useAiBasedRenameFilesFlow({
  plans,
  mediaMetadata,
  onAppRenameConfirm,
  setSelectedMediaMetadataByMediaFolderPath,
  onFlowStart,
}: UseAiBasedRenameFilesFlowOptions) {
  const updatePlanMutation = useUpdatePlanMutation()
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

  const promptStatus: "generating" | "wait-for-ack" =
    plan?.status === "preparing" ? "generating" : "wait-for-ack"

  useEffect(() => {
    console.log(
      `[rename] useAiBasedRenameFilesFlow: plan=${plan ? `id=${plan.id} status=${plan.status}` : "undefined"}, ` +
      `mediaFolderPath=${mediaFolderPath}, plansCount=${plans.length}`,
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan?.id, plan?.status, plans.length, mediaFolderPath])

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
