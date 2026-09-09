import { useCallback, useMemo, useState } from "react"
import { toast } from "sonner"
import { type RenameRuleName } from "@/api/tryToRenameEpisodes"
import { useApplyPlanMutation } from "@/hooks/plans/useApplyPlanMutation"
import { useRejectPlanMutation } from "@/hooks/plans/useRejectPlanMutation"
import { useTryToRenameEpisodesMutation } from "@/hooks/plans/useTryToRenameEpisodesMutation"
import { useTranslation } from "@/lib/i18n"
import type { MediaMetadata } from "@smm/types"
import type { RenameFilesPlan } from "@smm/types/RenameFilesPlan"

export interface RenameToolbarOption {
  value: "plex" | "emby"
  label: string
}

export interface UseRuleBasedRenameFilesFlowOptions {
  mediaMetadata: MediaMetadata | undefined
}

/**
 * Rule-based rename flow aligned with docs/dev/rename-episodes.md:
 * try-to-rename-episodes → (reject-plan + try-to-rename-episodes on rule switch) → apply-plan.
 */
export function useRuleBasedRenameFilesFlow({
  mediaMetadata,
}: UseRuleBasedRenameFilesFlowOptions) {
  const { t } = useTranslation(["components"])

  const [open, setOpen] = useState(false)
  const [plan, setPlan] = useState<RenameFilesPlan | undefined>(undefined)

  const mediaFolderPath = mediaMetadata?.mediaFolderPath
  const rejectPlanMutation = useRejectPlanMutation()
  const applyPlanMutation = useApplyPlanMutation()
  const tryToRenameEpisodesMutation = useTryToRenameEpisodesMutation()

  const loading =
    rejectPlanMutation.isPending ||
    applyPlanMutation.isPending ||
    tryToRenameEpisodesMutation.isPending


  const renameFailedMessage = t("toast.renameFailed", {
    defaultValue: "Rename failed. Please try again.",
  })

  const namingRuleOptions = useMemo(
    (): RenameToolbarOption[] => [
      { value: "plex", label: t("toolbar.plex") },
      { value: "emby", label: t("toolbar.emby") },
    ],
    [t],
  )

  const [selectedNamingRule, setSelectedNamingRule] = useState<RenameRuleName>(
    namingRuleOptions[0]?.value ?? "plex",
  )

  const reset = useCallback(() => {
    rejectPlanMutation.reset()
    applyPlanMutation.reset()
    tryToRenameEpisodesMutation.reset()
  }, [
    rejectPlanMutation,
    applyPlanMutation,
    tryToRenameEpisodesMutation
  ])

  /**
   * Generate or refresh the rename preview.
   * Triggered from:
   * 1. Click Rename (default naming rule)
   * 2. User changing the naming rule dropdown (reject + try-to-rename)
   */
  const selectNamingRule = useCallback(
    async (rule: RenameRuleName) => {
      if (!mediaFolderPath) {
        console.warn("[rename] cannot generate preview — media folder path missing", { rule })
        toast.error(renameFailedMessage)
        return
      }

      setSelectedNamingRule(rule)

      if (plan && plan.status === "pending") {
        try {
          rejectPlanMutation.mutateAsync({ id: plan.id, mediaFolderPath }) // fire and forget
        } catch (error) {
          console.error("[rename] failed to generate rename preview", { mediaFolderPath, rule, error })
        }
      }

      try {
        const resp = await tryToRenameEpisodesMutation.mutateAsync({ mediaFolderPath, rule })
        setPlan(resp as RenameFilesPlan)
      } catch (error) {
        console.error(`Unable to create rename episodes plan: rule=${rule}, folder=${mediaFolderPath}`, error)
        toast.error(renameFailedMessage)
      }
    },
    [
      plan,
      setPlan,
      mediaFolderPath,
      renameFailedMessage,
      rejectPlanMutation,
      tryToRenameEpisodesMutation,
    ],
  )

  const confirm = useCallback(
    async (selectedEpisodeFiles?: string[]) => {

      if (plan === undefined) {
        console.error(`Plan was confirmed but the plan is undefined`)
        return;
      }

      if (!mediaMetadata || !mediaFolderPath) {
        console.warn("[rename] user confirmed but media metadata missing", { plan })
        toast.error("No media metadata available")
        return
      }

      try {
        console.log("[rename] POST /api/apply-plan", { id: plan.id, selectedCount: selectedEpisodeFiles?.length })
        await applyPlanMutation.mutateAsync({ id: plan.id, mediaFolderPath, files: selectedEpisodeFiles })

        setOpen(false)
        setPlan(undefined)
        console.log("[rename] rename completed successfully", { id: plan.id })
      } catch (error) {
        console.error("[rename] unexpected error while applying rename", { id: plan.id, error })
        toast.error(renameFailedMessage)
      }
    },
    [
      mediaFolderPath,
      plan,
      applyPlanMutation,
      renameFailedMessage,
    ],
  )


  const cancel = useCallback(
    async () => {

      if(mediaFolderPath === undefined) {
        console.error(`Media folder path is undefined`)
        return;
      }

      setOpen(false)

      if (plan && plan.status === 'pending') {
        rejectPlanMutation.mutateAsync({ id: plan.id, mediaFolderPath }) // fire and forget
      }

      setPlan(undefined)
      reset()

    },
    [mediaFolderPath, rejectPlanMutation, renameFailedMessage, plan, reset],
  )

  /** Opens RuleBasedRenameFilePrompt by calling try-to-rename-episodes with the default rule. */
  const start = useCallback(() => {

    if (!mediaFolderPath) {
      console.warn("[rename] cannot start — media folder path missing")
      toast.error("No media folder path available")
      return
    }
    reset()
    setOpen(true)
    void selectNamingRule(selectedNamingRule)
  }, [
    mediaFolderPath,
    selectedNamingRule,
    selectNamingRule,
    reset
  ])

  const isConfirmButtonDisabled = loading || plan?.files.length === 0

  return {
    plan,
    open,
    loading,
    isConfirmButtonDisabled,
    selectedNamingRule,
    namingRuleOptions,
    selectNamingRule,
    confirm,
    cancel,
    start,
  }
}
