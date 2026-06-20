import type { RenameFilesPlan } from "@core/types/RenameFilesPlan"
import { toast } from "sonner"
import type { MediaMetadata } from "@core/types"
import type { UIPlan } from "@/types/UIPlan"
import type { UIRenameFilesPlan } from "@/types/UIRenameFilesPlan"
import type { PersistUIMediaMetadataFn } from "@/types/persistUIMediaMetadata"
import { applyRenameFilesPlanForTvShow } from "@/actions/applyRenameFilesPlanForTvShow"
import { applyRenamePairsToUIMediaMetadata } from "@/lib/applyRenamePairsToUIMediaMetadata"
import { rebuildRenamePlanWithSelectedEpisodes } from "@/components/TvShowPanelUtils"
export type SetPlanByIdFn = (id: string, payload: Partial<UIPlan>) => void | Promise<void>

export type RenameFilesApi = Parameters<typeof applyRenameFilesPlanForTvShow>[1]["renameFilesApi"]

export async function handleRenamePromptConfirmForTvShow(
  options: {
    planId: string
    plan: UIRenameFilesPlan
    mediaMetadata: MediaMetadata
    selectedEpisodePaths: string[]
    renameFailedLabel: string
    noMediaPathErrorLabel: string
  },
  deps: {
    setPlanById: SetPlanByIdFn
    persistUiMediaMetadata: PersistUIMediaMetadataFn
    renameFilesApi: RenameFilesApi
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
  const { setPlanById, persistUiMediaMetadata, renameFilesApi } = deps

  if (!mediaMetadata.mediaFolderPath || !mediaMetadata.files) {
    toast.error(noMediaPathErrorLabel)
    return
  }

  const actualPlan: UIRenameFilesPlan = rebuildRenamePlanWithSelectedEpisodes(
    plan as RenameFilesPlan,
    selectedEpisodePaths,
  )
  await setPlanById(planId, { status: "preparing" })
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
    // Persist terminal status: removes the plan file and drops it from cache.
    await setPlanById(planId, { status: "completed" })
  } catch (error) {
    console.error("[handleRenamePromptConfirmForTvShow] Error applying rename plan:", error)
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    toast.error(`${renameFailedLabel}: ${errorMessage}`)
    await setPlanById(planId, { status: "pending" })
  }
}
