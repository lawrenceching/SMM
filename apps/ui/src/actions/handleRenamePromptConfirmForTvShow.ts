import type { RenameFilesPlan } from "@core/types/RenameFilesPlan"
import { toast } from "sonner"
import type { MediaMetadata } from "@core/types"
import type { UIPlan } from "@/types/UIPlan"
import type { UIRenameFilesPlan } from "@/types/UIRenameFilesPlan"
import type { PersistUIMediaMetadataFn } from "@/types/persistUIMediaMetadata"
import { applyRenameFilesPlanForTvShow } from "@/actions/applyRenameFilesPlanForTvShow"
import { applyRenamePairsToUIMediaMetadata } from "@/lib/applyRenamePairsToUIMediaMetadata"
import { rebuildRenamePlanWithSelectedEpisodes } from "@/components/tv/TvShowPanelUtils"
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
    console.warn("[rename] cannot apply rename — folder path or file list missing", { planId })
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
    console.log("[rename] disk rename succeeded, updating local metadata", {
      planId,
      traceId: renameTraceId,
      renamedCount: renameList.length,
    })
    const updatedMetadata = applyRenamePairsToUIMediaMetadata(mediaMetadata, renameList)
    await persistUiMediaMetadata(mediaMetadata.mediaFolderPath, updatedMetadata, {
      traceId: renameTraceId,
    })
    await setPlanById(planId, { status: "completed" })
    console.log("[rename] rename plan completed and closed", { planId, traceId: renameTraceId })
  } catch (error) {
    console.error("[rename] disk rename or metadata update failed", {
      planId,
      traceId: renameTraceId,
      error,
    })
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    toast.error(`${renameFailedLabel}: ${errorMessage}`)
    try {
      await setPlanById(planId, { status: "pending" })
      console.log("[rename] rename plan restored to pending so user can retry", { planId })
    } catch (revertError) {
      console.error("[rename] failed to restore rename plan after error", { planId, error: revertError })
      toast.error(renameFailedLabel)
    }
  }
}
