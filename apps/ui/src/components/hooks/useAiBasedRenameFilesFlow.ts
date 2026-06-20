import { useEffect } from "react"
import { toast } from "sonner"
import { cleanupRenamePlan } from "@/ai/tools/EndRenameFilesTask"
import { useTvShowWebSocketEvents } from "@/components/hooks/useTvShowWebSocketEvents"
import { mediaFolderPathEqual } from "@/components/TvShowPanelUtils"
import { useFeatures } from "@/hooks/useFeatures"
import { toUpdatePlanPatch, useUpdatePlanMutation } from "@/hooks/plans"
import { useTvShowPromptsStore } from "@/stores/tvShowPromptsStore"
import type { MediaMetadata } from "@core/types"
import type { UIPlan } from "@/types/UIPlan"
import type { UIRenameFilesPlan } from "@/types/UIRenameFilesPlan"

export interface UseAiBasedRenameFilesFlowOptions {
  plans: UIPlan[]
  mediaMetadata: MediaMetadata | undefined
  onAppRenameConfirm: (planId: string) => Promise<void>
  setSelectedMediaMetadataByMediaFolderPath: (path: string) => void
  updateMediaMetadata: (
    path: string,
    updaterOrMetadata: MediaMetadata | ((current: MediaMetadata) => MediaMetadata),
    options?: { traceId?: string },
  ) => void | Promise<void>
  /** Called when an AI rename plan is detected (e.g. switch episode table to simple layout). */
  onFlowStart?: () => void
}

/**
 * Surfaces AI/MCP-created rename plans via AiBasedRenameFilePrompt and handles
 * WebSocket-driven rename confirmation events. Rule-based (creator: 'app') plans
 * are handled exclusively by RuleBasedRenameFilePrompt.
 */
export function useAiBasedRenameFilesFlow({
  plans,
  mediaMetadata,
  onAppRenameConfirm,
  setSelectedMediaMetadataByMediaFolderPath,
  updateMediaMetadata,
  onFlowStart,
}: UseAiBasedRenameFilesFlowOptions) {
  const { isAiFeatureEnabled } = useFeatures()
  const updatePlanMutation = useUpdatePlanMutation()

  const openAiBasedRenameFilePrompt = useTvShowPromptsStore(
    (state) => state.openAiBasedRenameFilePrompt,
  )
  const closeAiBasedRenameFilePrompt = useTvShowPromptsStore(
    (state) => state.closeAiBasedRenameFilePrompt,
  )
  const updateAiBasedRenameFileStatus = useTvShowPromptsStore(
    (state) => state.updateAiBasedRenameFileStatus,
  )

  useEffect(() => {
    if (!isAiFeatureEnabled || !mediaMetadata?.mediaFolderPath) {
      if (!isAiFeatureEnabled) {
        closeAiBasedRenameFilePrompt()
      }
      return
    }

    const plan = plans.find(
      (p): p is UIRenameFilesPlan =>
        p.task === "rename-files" &&
        p.creator === "ai" &&
        p.status === "pending" &&
        mediaFolderPathEqual(p.mediaFolderPath, mediaMetadata.mediaFolderPath),
    )

    if (plan) {
      console.log(
        `[useAiBasedRenameFilesFlow] Detected pending AI RenameFilesPlan, open AiBasedRenameFilePrompt:`,
        plan,
      )
      onFlowStart?.()
      openAiBasedRenameFilePrompt({
        status: "wait-for-ack",
        onConfirm: () => onAppRenameConfirm(plan.id),
        onCancel: async () => {
          try {
            await updatePlanMutation.mutateAsync({
              id: plan.id,
              mediaFolderPath: mediaMetadata.mediaFolderPath!,
              patch: toUpdatePlanPatch({ status: "rejected" }),
            })
            await cleanupRenamePlan(plan.id)
          } catch (error) {
            console.error("[useAiBasedRenameFilesFlow] Error rejecting rename plan:", error)
            toast.error(
              `Failed to reject rename plan: ${error instanceof Error ? error.message : "Unknown error"}`,
            )
          }
        },
      })
    } else {
      closeAiBasedRenameFilePrompt()
    }
  }, [
    isAiFeatureEnabled,
    plans,
    mediaMetadata,
    openAiBasedRenameFilePrompt,
    closeAiBasedRenameFilePrompt,
    onAppRenameConfirm,
    updatePlanMutation,
    onFlowStart,
  ])

  useTvShowWebSocketEvents({
    mediaMetadata,
    setSelectedMediaMetadataByMediaFolderPath,
    openAiBasedRenameFilePrompt,
    setAiBasedRenameFileStatus: updateAiBasedRenameFileStatus,
    updateMediaMetadata,
  })
}
