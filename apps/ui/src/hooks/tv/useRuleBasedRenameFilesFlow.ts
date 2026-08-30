import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { applyPlan } from "@/api/applyPlan"
import { rejectPlan } from "@/api/rejectPlan"
import { tryToRenameEpisodes, type RenameRuleName } from "@/api/tryToRenameEpisodes"
import { selectActiveAppPlan } from "@/components/tv/plans/selectActiveAppPlan"
import { plansQueryKey } from "@/hooks/plans/plansQueryKeys"
import { useFetchMediaMetadataMutation } from "@/hooks/mediaMetadata/useFetchMediaMetadataMutation"
import {
  mediaMetadataQueryKey,
  normalizeMediaFolderPathForQuery,
} from "@/lib/mediaMetadataQueryKeys"
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

/**
 * Rule-based rename flow aligned with docs/dev/rename-episodes.md:
 * try-to-rename-episodes → (reject-plan + try-to-rename-episodes on rule switch) → apply-plan.
 */
export function useRuleBasedRenameFilesFlow({
  plans,
  mediaMetadata,
  uiStatus: _uiStatus,
  beforeConfirm,
  onFlowStart,
}: UseRuleBasedRenameFilesFlowOptions) {
  const { t } = useTranslation(["components"])
  const queryClient = useQueryClient()
  const mediaFolderPath = mediaMetadata?.mediaFolderPath
  const { mutateAsync: fetchMediaMetadata } = useFetchMediaMetadataMutation()
  const [loading, setLoading] = useState(false)
  const inFlightRef = useRef(false)

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

  const plansKey = useMemo(
    () =>
      mediaFolderPath
        ? plansQueryKey(normalizeMediaFolderPathForQuery(mediaFolderPath))
        : null,
    [mediaFolderPath],
  )

  const upsertPlanInCache = useCallback(
    (next: UIRenameFilesPlan, removeId?: string) => {
      if (!plansKey) return
      queryClient.setQueryData<Plan[]>(plansKey, (prev) => {
        const list = (prev ?? []).filter(
          (p) => p.id !== next.id && (removeId === undefined || p.id !== removeId),
        )
        return [...list, next]
      })
    },
    [plansKey, queryClient],
  )

  const removePlanFromCache = useCallback(
    (planId: string) => {
      if (!plansKey) return
      console.log("[rename] removed rename plan from UI cache", { planId, mediaFolderPath })
      queryClient.setQueryData<Plan[]>(plansKey, (prev) =>
        (prev ?? []).filter((p) => p.id !== planId),
      )
    },
    [plansKey, mediaFolderPath, queryClient],
  )

  const requestTryToRename = useCallback(
    async (rule: RenameRuleName, removePlanId?: string): Promise<UIRenameFilesPlan> => {
      if (!mediaFolderPath) {
        throw new Error("No media folder path available")
      }
      console.log("[rename] POST /api/try-to-rename-episodes", {
        mediaFolderPath,
        namingRule: rule,
      })
      const resp = await tryToRenameEpisodes({ mediaFolderPath, rule })
      if (resp.error || !resp.data?.plan) {
        throw new Error(resp.error ?? "try-to-rename-episodes: empty response")
      }
      const next = resp.data.plan as UIRenameFilesPlan
      upsertPlanInCache(next, removePlanId)
      console.log("[rename] rename preview ready — user can review and confirm", {
        planId: next.id,
        namingRule: rule,
        fileCount: next.files.length,
        preview: next.files.map((f) => ({
          from: fileBaseName(f.from),
          to: fileBaseName(f.to),
        })),
      })
      return next
    },
    [mediaFolderPath, upsertPlanInCache],
  )

  const requestRejectPlan = useCallback(
    async (planId: string): Promise<void> => {
      console.log("[rename] POST /api/reject-plan", { planId })
      const resp = await rejectPlan({ id: planId })
      if (resp.error) {
        throw new Error(resp.error)
      }
      removePlanFromCache(planId)
      console.log("[rename] rename plan rejected", { planId })
    },
    [removePlanFromCache],
  )

  /**
   * Generate or refresh the rename preview.
   * Triggered from:
   * 1. Click Rename (default naming rule)
   * 2. User changing the naming rule dropdown (reject + try-to-rename)
   */
  const onNamingRuleSelected = useCallback(
    async (rule: RenameRuleName) => {
      if (!mediaFolderPath) {
        console.warn("[rename] cannot generate preview — media folder path missing", { rule })
        toast.error(renameFailedMessage)
        return
      }

      if (inFlightRef.current) {
        return
      }
      inFlightRef.current = true
      setLoading(true)

      const previousPlanId = plan?.id
      const isSwitch = previousPlanId !== undefined

      console.log(
        isSwitch
          ? "[rename] user selected naming rule — regenerating preview"
          : "[rename] rename prompt opened — generating preview with default naming rule",
        {
          planId: previousPlanId,
          namingRule: rule,
          planStatus: plan?.status,
          tvShow: mediaMetadata?.tvShow?.name,
          mediaFolderPath,
        },
      )

      try {
        if (previousPlanId) {
          await requestRejectPlan(previousPlanId)
        }
        await requestTryToRename(rule, previousPlanId)
      } catch (error) {
        console.error("[rename] failed to build rename preview", {
          planId: previousPlanId,
          namingRule: rule,
          error,
        })
        const message =
          error instanceof Error && error.message ? error.message : renameFailedMessage
        toast.error(message)
        if (previousPlanId) {
          removePlanFromCache(previousPlanId)
        }
      } finally {
        inFlightRef.current = false
        setLoading(false)
      }
    },
    [
      plan,
      mediaFolderPath,
      mediaMetadata?.tvShow?.name,
      requestRejectPlan,
      requestTryToRename,
      removePlanFromCache,
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

      if (!mediaMetadata || !mediaFolderPath) {
        console.warn("[rename] user confirmed but media metadata missing", { planId })
        toast.error("No media metadata available")
        return
      }

      // Selection filtering is applied client-side for UX; server apply uses the stored plan.
      // Checkbox-limited applies still go through apply-plan (sequence diagram).
      const preparedPlan = beforeConfirm(targetPlan)
      console.log("[rename] user confirmed — applying plan", {
        planId,
        fileCount: preparedPlan.files.length,
        files: preparedPlan.files.map((f) => ({
          from: fileBaseName(f.from),
          to: fileBaseName(f.to),
        })),
      })

      try {
        console.log("[rename] POST /api/apply-plan", { planId })
        const resp = await applyPlan({ id: planId })
        if (resp.error) {
          throw new Error(resp.error)
        }
        removePlanFromCache(planId)
        const pathPosix = normalizeMediaFolderPathForQuery(mediaFolderPath)
        await queryClient.invalidateQueries({ queryKey: mediaMetadataQueryKey(pathPosix) })
        await fetchMediaMetadata({ path: mediaFolderPath })
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
      removePlanFromCache,
      queryClient,
      fetchMediaMetadata,
      renameFailedMessage,
    ],
  )

  const onCancel = useCallback(
    async (planId: string) => {
      console.log("[rename] user cancelled rename preview", { planId })
      try {
        await requestRejectPlan(planId)
        console.log("[rename] rename plan cancelled", { planId })
      } catch (error) {
        console.error("[rename] failed to cancel rename plan, cleared from cache", { planId, error })
        removePlanFromCache(planId)
        toast.error(renameFailedMessage)
      }
    },
    [requestRejectPlan, removePlanFromCache, renameFailedMessage],
  )

  /** Opens RuleBasedRenameFilePrompt by calling try-to-rename-episodes with the default rule. */
  const startRenameFlow = useCallback(() => {
    if (!mediaFolderPath) {
      console.warn("[rename] cannot start — media folder path missing")
      toast.error("No media folder path available")
      return
    }

    onFlowStart?.()

    console.log("[rename] user clicked rename — opening rename prompt", {
      mediaFolderPath,
      defaultNamingRule: selectedNamingRule,
      tvShow: mediaMetadata?.tvShow?.name,
    })

    void onNamingRuleSelected(selectedNamingRule)
  }, [
    mediaFolderPath,
    mediaMetadata?.tvShow?.name,
    onFlowStart,
    selectedNamingRule,
    onNamingRuleSelected,
  ])

  useEffect(() => {
    if (plan) {
      onFlowStart?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan?.id, onFlowStart])

  const allRenamePlanFilesUnchanged = useMemo(() => {
    if (
      !plan ||
      plan.status !== "pending" ||
      plan.task !== "rename-files" ||
      !mediaMetadata
    ) {
      return false
    }
    return plan.files.length === 0 && (mediaMetadata.mediaFiles?.length ?? 0) > 0
  }, [plan, mediaMetadata])

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
    allRenamePlanFilesUnchanged,
  }
}
