import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { handleRenamePromptConfirmForTvShow } from "@/actions/handleRenamePromptConfirmForTvShow"
import { renameFiles } from "@/api/renameFiles"
import { selectActiveAppPlan } from "@/components/tv/plans/selectActiveAppPlan"
import { useTvShowFileNameGeneration } from "./useTvShowFileNameGeneration"
import { useCreatePlanMutation, toUpdatePlanPatch, useUpdatePlanMutation } from "@/hooks/plans"
import { useUpdateMediaMetadataMutation } from "@/hooks/mediaMetadata/useUpdateMediaMetadataMutation"
import { useOnFirstOpen } from "@/hooks/useOnFirstOpen"
import { useTranslation } from "@/lib/i18n"
import type { RenameToolbarOption } from "@/components/tv/plans/TvShowAppPlanPromptContext"
import type { UIPlan } from "@/types/UIPlan"
import type { MediaMetadata } from "@core/types"
import type { UIRenameFilesPlan } from "@/types/UIRenameFilesPlan"

export interface UseRuleBasedRenameFilesFlowOptions {
  plans: UIPlan[]
  mediaMetadata: MediaMetadata | undefined
  beforeConfirm: (plan: UIRenameFilesPlan) => UIRenameFilesPlan
  /** Called when the rename flow starts (e.g. switch episode table to simple layout). */
  onFlowStart?: () => void
}

export function useRuleBasedRenameFilesFlow({
  plans,
  mediaMetadata,
  beforeConfirm,
  onFlowStart,
}: UseRuleBasedRenameFilesFlowOptions) {
  const { t } = useTranslation(["components"])
  const mediaFolderPath = mediaMetadata?.mediaFolderPath
  const createPlanMutation = useCreatePlanMutation()
  const updatePlanMutation = useUpdatePlanMutation()
  const { persistMediaMetadata } = useUpdateMediaMetadataMutation()

  const namingRuleOptions = useMemo(
    (): RenameToolbarOption[] => [
      { value: "plex", label: t("toolbar.plex") },
      { value: "emby", label: t("toolbar.emby") },
    ],
    [t],
  )

  const [selectedNamingRule, setSelectedNamingRule] = useState<"plex" | "emby">(
    namingRuleOptions[0]?.value ?? "plex",
  )

  const plan = useMemo(
    () =>
      selectActiveAppPlan<UIRenameFilesPlan>(
        plans,
        mediaFolderPath,
        "rename-files",
      ),
    [plans, mediaFolderPath],
  )

  const open = plan !== undefined
  const loading = plan?.status === "preparing"

  const { generateNewFileNames } = useTvShowFileNameGeneration({
    mediaMetadata,
    selectedNamingRule,
  })

  const onNamingRuleSelected = useCallback(
    async (rule: "plex" | "emby") => {
      if (!plan || !mediaFolderPath) return

      try {
        const renamePlan = generateNewFileNames(rule)
        if (renamePlan) {
          await updatePlanMutation.mutateAsync({
            id: plan.id,
            mediaFolderPath,
            patch: toUpdatePlanPatch({ status: "pending", files: renamePlan.files }),
          })
        } else {
          await updatePlanMutation.mutateAsync({
            id: plan.id,
            mediaFolderPath,
            patch: toUpdatePlanPatch({ status: "rejected" }),
          })
        }
      } catch (error) {
        console.error("[useRuleBasedRenameFilesFlow] Error generating file names:", error)
        await updatePlanMutation.mutateAsync({
          id: plan.id,
          mediaFolderPath,
          patch: toUpdatePlanPatch({ status: "rejected" }),
        })
      }
    },
    [plan, generateNewFileNames, mediaFolderPath, updatePlanMutation],
  )

  const onConfirm = useCallback(
    async (planId: string) => {
      const targetPlan = plans.find((p) => p.id === planId) as UIRenameFilesPlan | undefined

      if (!targetPlan) {
        console.error("[useRuleBasedRenameFilesFlow] No rename plan found")
        toast.error("Failed to find rename plan")
        return
      }

      if (!mediaMetadata) {
        toast.error("No media metadata available")
        return
      }

      const preparedPlan = beforeConfirm(targetPlan)

      await handleRenamePromptConfirmForTvShow(
        {
          planId,
          plan: preparedPlan,
          mediaMetadata,
          selectedEpisodePaths: preparedPlan.files.map((f) => f.from),
          renameFailedLabel: t("episodeFile.renameFailed"),
          noMediaPathErrorLabel: t("movie.noMediaPathError"),
        },
        {
          setPlanById: async (id, patch) => {
            if (!mediaFolderPath) return
            await updatePlanMutation.mutateAsync({
              id,
              mediaFolderPath,
              patch: toUpdatePlanPatch(patch),
            })
          },
          persistUiMediaMetadata: persistMediaMetadata,
          renameFilesApi: renameFiles,
        },
      )
    },
    [plans, mediaMetadata, mediaFolderPath, beforeConfirm, updatePlanMutation, persistMediaMetadata, t],
  )

  const onCancel = useCallback(
    async (planId: string) => {
      if (!mediaFolderPath) return
      try {
        await updatePlanMutation.mutateAsync({
          id: planId,
          mediaFolderPath,
          patch: toUpdatePlanPatch({ status: "rejected" }),
        })
      } catch (error) {
        console.error("[useRuleBasedRenameFilesFlow] Error rejecting rename plan:", error)
      }
    },
    [mediaFolderPath, updatePlanMutation],
  )

  const startRenameFlow = useCallback(() => {
    if (!mediaFolderPath) {
      toast.error("No media folder path available")
      return
    }

    onFlowStart?.()

    void createPlanMutation.createPlanOptimistic({
      id: crypto.randomUUID(),
      task: "rename-files",
      mediaFolderPath,
      creator: "app",
    })
  }, [mediaFolderPath, onFlowStart, createPlanMutation])

  useOnFirstOpen(
    () => {
      void onNamingRuleSelected(selectedNamingRule)
    },
    open && plan?.status === "preparing" && plan.files.length === 0,
    [plan?.id, selectedNamingRule, onNamingRuleSelected],
  )

  useEffect(() => {
    if (plan) {
      onFlowStart?.()
    }
  }, [plan?.id, onFlowStart])

  return {
    plan,
    open,
    loading,
    selectedNamingRule,
    setSelectedNamingRule,
    namingRuleOptions,
    onNamingRuleSelected,
    onConfirm,
    onCancel,
    startRenameFlow,
  }
}
