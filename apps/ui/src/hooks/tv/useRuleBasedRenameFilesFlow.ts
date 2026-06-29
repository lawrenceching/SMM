import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { handleRenamePromptConfirmForTvShow } from "@/actions/handleRenamePromptConfirmForTvShow"
import { renameFiles } from "@/api/renameFiles"
import { selectActiveAppPlan } from "@/components/tv/plans/selectActiveAppPlan"
import { useTvShowFileNameGeneration } from "./useTvShowFileNameGeneration"
import { useCreatePlanMutation, toUpdatePlanPatch, useUpdatePlanMutation } from "@/hooks/plans"
import { plansQueryKey } from "@/hooks/plans/plansQueryKeys"
import { useUpdateMediaMetadataMutation } from "@/hooks/mediaMetadata/useUpdateMediaMetadataMutation"
import { useOnFirstOpen } from "@/hooks/useOnFirstOpen"
import { normalizeMediaFolderPathForQuery } from "@/lib/mediaMetadataQueryKeys"
import { useTranslation } from "@/lib/i18n"
import type { RenameToolbarOption } from "@/components/tv/plans/TvShowAppPlanPromptContext"
import type { Plan } from "@/api/getPlans"
import type { UIPlan } from "@/types/UIPlan"
import type { MediaMetadata } from "@core/types"
import type { UIMediaFolderStatus } from "@/types/UIMediaFolder"
import type { UIRenameFilesPlan } from "@/types/UIRenameFilesPlan"

export interface UseRuleBasedRenameFilesFlowOptions {
  plans: UIPlan[]
  mediaMetadata: MediaMetadata | undefined
  uiStatus: UIMediaFolderStatus | undefined
  beforeConfirm: (plan: UIRenameFilesPlan) => UIRenameFilesPlan
  /** Called when the rename flow starts (e.g. switch episode table to simple layout). */
  onFlowStart?: () => void
}

function fileBaseName(path: string): string {
  const i = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"))
  return i >= 0 ? path.slice(i + 1) : path
}

export function useRuleBasedRenameFilesFlow({
  plans,
  mediaMetadata,
  uiStatus,
  beforeConfirm,
  onFlowStart,
}: UseRuleBasedRenameFilesFlowOptions) {
  const { t } = useTranslation(["components"])
  const queryClient = useQueryClient()
  const mediaFolderPath = mediaMetadata?.mediaFolderPath
  const createPlanMutation = useCreatePlanMutation()
  const updatePlanMutation = useUpdatePlanMutation()
  const { persistMediaMetadata } = useUpdateMediaMetadataMutation()
  const generationRef = useRef(new Set<string>())

  const renameFailedMessage = t("toast.renameFailed", {
    defaultValue: "Rename failed. Please try again.",
  })
  const noRenameFilesMessage = t("toast.noRenameFiles", {
    defaultValue: "Unable to generate a rename plan. Check that episodes have video files.",
  })

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

  const removePlanFromCache = useCallback(
    (planId: string) => {
      if (!mediaFolderPath) return
      console.log("[rename] removed stuck rename plan from UI cache", { planId, mediaFolderPath })
      const key = plansQueryKey(normalizeMediaFolderPathForQuery(mediaFolderPath))
      queryClient.setQueryData<Plan[]>(key, (prev) =>
        (prev ?? []).filter((p) => p.id !== planId),
      )
    },
    [mediaFolderPath, queryClient],
  )

  const failRenamePlan = useCallback(
    async (planId: string, message: string, reason: string) => {
      console.warn("[rename] rename flow failed — closing prompt", { planId, reason, message })
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
        console.log("[rename] rename plan marked rejected", { planId })
      } catch (error) {
        console.error("[rename] could not reject rename plan on server, cleared from cache", {
          planId,
          error,
        })
        removePlanFromCache(planId)
      }
    },
    [mediaFolderPath, updatePlanMutation, removePlanFromCache],
  )

  const applyGeneratedRenamePlan = useCallback(
    async (planId: string, rule: "plex" | "emby") => {
      const renamePlan = generateNewFileNames(rule)
      if (renamePlan && renamePlan.files.length > 0) {
        await updatePlanMutation.mutateAsync({
          id: planId,
          mediaFolderPath: mediaFolderPath!,
          patch: toUpdatePlanPatch({ status: "pending", files: renamePlan.files }),
        })
        console.log("[rename] rename preview ready — user can review and confirm", {
          planId,
          namingRule: rule,
          tvShow: mediaMetadata?.tvShow?.name,
          fileCount: renamePlan.files.length,
          preview: renamePlan.files.map((f) => ({
            from: fileBaseName(f.from),
            to: fileBaseName(f.to),
          })),
        })
        return
      }
      await failRenamePlan(planId, noRenameFilesMessage, "no rename candidates")
    },
    [
      generateNewFileNames,
      mediaFolderPath,
      mediaMetadata?.tvShow?.name,
      updatePlanMutation,
      failRenamePlan,
      noRenameFilesMessage,
    ],
  )

  /**
   * Generate or refresh the rename preview for the active plan.
   * Triggered only from:
   * 1. First open of RuleBasedRenameFilePrompt (default naming rule via useOnFirstOpen)
   * 2. User changing the naming rule dropdown in the prompt
   */
  const onNamingRuleSelected = useCallback(
    async (rule: "plex" | "emby") => {
      if (!plan || !mediaFolderPath || !mediaMetadata) {
        console.warn("[rename] cannot generate preview — plan or metadata missing", { rule })
        toast.error(renameFailedMessage)
        return
      }

      if (generationRef.current.has(plan.id)) {
        return
      }
      generationRef.current.add(plan.id)

      const isInitialGeneration = plan.status === "preparing" && plan.files.length === 0
      console.log(
        isInitialGeneration
          ? "[rename] rename prompt opened — generating preview with default naming rule"
          : "[rename] user selected naming rule — regenerating preview",
        {
          planId: plan.id,
          namingRule: rule,
          planStatus: plan.status,
          tvShow: mediaMetadata.tvShow?.name,
          mediaFolderPath,
        },
      )

      console.log("[rename] computing episode file names for rename preview", {
        planId: plan.id,
        namingRule: rule,
      })

      try {
        await applyGeneratedRenamePlan(plan.id, rule)
      } catch (error) {
        console.error("[rename] failed to build rename preview", {
          planId: plan.id,
          namingRule: rule,
          error,
        })
        const message =
          error instanceof Error && error.message ? error.message : renameFailedMessage
        await failRenamePlan(plan.id, message, "preview generation error")
      } finally {
        generationRef.current.delete(plan.id)
      }
    },
    [
      plan,
      mediaFolderPath,
      mediaMetadata,
      applyGeneratedRenamePlan,
      failRenamePlan,
      renameFailedMessage,
    ],
  )

  const onConfirm = useCallback(
    async (planId: string) => {
      const targetPlan = plans.find((p) => p.id === planId) as UIRenameFilesPlan | undefined

      if (!targetPlan) {
        console.warn("[rename] user confirmed but rename plan not found", { planId })
        toast.error("Failed to find rename plan")
        return
      }

      if (!mediaMetadata) {
        console.warn("[rename] user confirmed but media metadata missing", { planId })
        toast.error("No media metadata available")
        return
      }

      const preparedPlan = beforeConfirm(targetPlan)
      console.log("[rename] user confirmed — renaming files on disk", {
        planId,
        fileCount: preparedPlan.files.length,
        files: preparedPlan.files.map((f) => ({
          from: fileBaseName(f.from),
          to: fileBaseName(f.to),
        })),
      })

      try {
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
        console.log("[rename] rename completed successfully", { planId })
      } catch (error) {
        console.error("[rename] unexpected error while applying rename", { planId, error })
        toast.error(renameFailedMessage)
      }
    },
    [
      plans,
      mediaMetadata,
      mediaFolderPath,
      beforeConfirm,
      updatePlanMutation,
      persistMediaMetadata,
      t,
      renameFailedMessage,
    ],
  )

  const onCancel = useCallback(
    async (planId: string) => {
      console.log("[rename] user cancelled rename preview", { planId })
      if (!mediaFolderPath) {
        return
      }
      try {
        await updatePlanMutation.mutateAsync({
          id: planId,
          mediaFolderPath,
          patch: toUpdatePlanPatch({ status: "rejected" }),
        })
        console.log("[rename] rename plan cancelled", { planId })
      } catch (error) {
        console.error("[rename] failed to cancel rename plan, cleared from cache", { planId, error })
        removePlanFromCache(planId)
        toast.error(renameFailedMessage)
      }
    },
    [mediaFolderPath, updatePlanMutation, removePlanFromCache, renameFailedMessage],
  )

  /** Opens RuleBasedRenameFilePrompt by creating an empty preparing plan. Preview generation is deferred to prompt open / naming rule selection. */
  const startRenameFlow = useCallback(() => {
    if (!mediaFolderPath) {
      console.warn("[rename] cannot start — media folder path missing")
      toast.error("No media folder path available")
      return
    }

    onFlowStart?.()

    const planId = crypto.randomUUID()
    console.log("[rename] user clicked rename — opening rename prompt", {
      planId,
      mediaFolderPath,
      defaultNamingRule: selectedNamingRule,
      tvShow: mediaMetadata?.tvShow?.name,
    })

    void createPlanMutation
      .createPlanOptimistic({
        id: planId,
        task: "rename-files",
        mediaFolderPath,
        creator: "app",
      })
      .then(() => {
        console.log("[rename] empty rename plan created, waiting for prompt to generate preview", {
          planId,
        })
      })
      .catch((err) => {
        console.error("[rename] failed to create rename plan", { planId, error: err })
        const message =
          err instanceof Error && err.message ? err.message : renameFailedMessage
        toast.error(message)
        removePlanFromCache(planId)
      })
  }, [
    mediaFolderPath,
    mediaMetadata?.tvShow?.name,
    onFlowStart,
    createPlanMutation,
    selectedNamingRule,
    renameFailedMessage,
    removePlanFromCache,
  ])

  useOnFirstOpen(
    () => {
      void onNamingRuleSelected(selectedNamingRule)
    },
    open &&
      plan?.status === "preparing" &&
      plan.files.length === 0 &&
      !!mediaMetadata &&
      uiStatus === "ok",
    [plan?.id, selectedNamingRule, onNamingRuleSelected, mediaMetadata, uiStatus],
  )

  useEffect(() => {
    if (plan?.status === "preparing" && uiStatus === "error_loading_metadata") {
      console.warn("[rename] metadata failed to load while preparing rename preview", {
        planId: plan.id,
      })
      void failRenamePlan(plan.id, renameFailedMessage, "metadata load error")
    }
  }, [plan?.id, plan?.status, uiStatus, failRenamePlan, renameFailedMessage])

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
