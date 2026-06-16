import type { RenameFilesPlan } from "@core/types/RenameFilesPlan"
import { toast } from "sonner"
import type { UIPlan } from "@/stores/plansStore"
import type { UIMediaMetadata } from "@/types/UIMediaMetadata"
import type { UIRenameFilesPlan } from "@/types/UIRenameFilesPlan"
import type { PersistUIMediaMetadataFn } from "@/types/persistUIMediaMetadata"
import { applyRenameFilesPlanForTvShow } from "@/actions/applyRenameFilesPlanForTvShow"
import { applyRenamePairsToUIMediaMetadata } from "@/lib/applyRenamePairsToUIMediaMetadata"
import { rebuildRenamePlanWithSelectedEpisodes } from "@/components/TvShowPanelUtils"
import { savePlan } from "@/actions/planActions"

export type SetPlanByIdFn = (id: string, payload: Partial<UIPlan>) => void | Promise<void>

export type RenameFilesApi = Parameters<typeof applyRenameFilesPlanForTvShow>[1]["renameFilesApi"]

export async function handleRenamePromptConfirmForTvShow(
  options: {
    planId: string
    plan: UIRenameFilesPlan
    mediaMetadata: UIMediaMetadata
    selectedEpisodePaths: string[]
    renameFailedLabel: string
    noMediaPathErrorLabel: string
  },
  deps: {
    setPlanById: SetPlanByIdFn
    persistUiMediaMetadata: PersistUIMediaMetadataFn
    renameFilesApi: RenameFilesApi
    cleanupRenamePlan: (planId: string) => Promise<void>
  },
): Promise<void> {
  const {
    planId,
    plan,
    mediaMetadata,
    selectedEpisodePaths,
    renameFailedLabel,
    noMediaPathErrorLabel,
  } = options
  const { setPlanById, persistUiMediaMetadata, renameFilesApi, cleanupRenamePlan } = deps

  if (!mediaMetadata.mediaFolderPath || !mediaMetadata.files) {
    toast.error(noMediaPathErrorLabel)
    return
  }

  const actualPlan: UIRenameFilesPlan = {
    ...rebuildRenamePlanWithSelectedEpisodes(plan as RenameFilesPlan, selectedEpisodePaths),
    tmp: plan.tmp,
  }
  await setPlanById(planId, { status: "loading" })
  const renameTraceId = `RuleBasedRenameConfirm-${planId}`

  try {
    const { renameList } = await applyRenameFilesPlanForTvShow(
      {
        mediaFolderPath: mediaMetadata.mediaFolderPath,
        localFiles: mediaMetadata.files,
        plan: actualPlan,
        traceId: renameTraceId,
      },
      { renameFilesApi },
    )
    const updatedMetadata = applyRenamePairsToUIMediaMetadata(mediaMetadata, renameList)
    await persistUiMediaMetadata(mediaMetadata.mediaFolderPath, updatedMetadata, {
      traceId: renameTraceId,
    })
    if (!plan.tmp) {
      savePlan(plan as UIPlan, {
        onSuccess: (savedPlan) => {
          setPlanById(savedPlan.id, { status: "completed" })
        },
        onError: (error) => {
          console.error(`[savePlan] Failed to save plan ${planId}:`, error)
        },
      })
    } else {
      setPlanById(planId, { status: "completed" })
      await cleanupRenamePlan(planId)
    }
  } catch (error) {
    console.error("[handleRenamePromptConfirmForTvShow] Error applying rename plan:", error)
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    toast.error(`${renameFailedLabel}: ${errorMessage}`)
    await setPlanById(planId, { status: "pending" })
  }
}
