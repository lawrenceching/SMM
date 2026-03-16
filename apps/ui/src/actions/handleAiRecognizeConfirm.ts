import type { RecognizeMediaFilePlan } from "@core/types/RecognizeMediaFilePlan"
import type { UIMediaMetadata } from "@/types/UIMediaMetadata"
import type { UIPlan } from "@/stores/plansStore"
import { nextTraceId } from "@/lib/utils"
import { toast } from "sonner"
import { updatePlan } from "@/api/updatePlan"
import { applyRecognizeMediaFilePlan } from "@/components/TvShowPanelUtils"

export type UpdateMediaMetadataFn = (
  path: string,
  metadata: UIMediaMetadata | ((current: UIMediaMetadata) => UIMediaMetadata),
  options?: { traceId?: string }
) => void

export type SetPlanByIdFn = (id: string, planProps: { status: UIPlan["status"] }) => void

/**
 * Apply AI-generated recognition plan: update plan status, apply recognition to media metadata, persist plan.
 * Caller must ensure plan.mediaFolderPath matches mediaMetadata.mediaFolderPath.
 */
export async function handleAiRecognizeConfirm(
  plan: RecognizeMediaFilePlan,
  mediaMetadata: UIMediaMetadata,
  updateMediaMetadata: UpdateMediaMetadataFn,
  setPlanById: SetPlanByIdFn
): Promise<void> {
  const traceId = `handleAiRecognizeConfirm-${nextTraceId()}`
  console.log(`[${traceId}] handleAiRecognizeConfirm CALLED`, {
    timestamp: new Date().toISOString(),
    plan,
    mediaFolderPath: mediaMetadata?.mediaFolderPath,
    stackTrace: new Error().stack,
  })

  if (!mediaMetadata?.mediaFolderPath) {
    toast.error("No media folder path available")
    return
  }

  if (plan.mediaFolderPath !== mediaMetadata.mediaFolderPath) {
    console.warn(`[${traceId}] Plan mediaFolderPath does not match current media metadata`, {
      planPath: plan.mediaFolderPath,
      currentPath: mediaMetadata.mediaFolderPath,
    })
    toast.error("Plan does not match current media folder")
    return
  }

  try {
    setPlanById(plan.id, { status: "completed" })
    await applyRecognizeMediaFilePlan(
      plan,
      mediaMetadata,
      updateMediaMetadata as (
        path: string,
        metadata: UIMediaMetadata | ((current: UIMediaMetadata) => UIMediaMetadata),
        options?: { traceId?: string }
      ) => void | Promise<void>,
      { traceId }
    )
    console.log(`[${traceId}] Applied recognition from plan`, { planFilesCount: plan.files.length })
    toast.success(`Applied recognition for ${plan.files.length} file(s)`)
    await updatePlan(plan.id, "completed")
  } catch (error) {
    console.error(`[${traceId}] Error applying recognition:`, error)
    toast.error("Failed to apply recognition")
  }
}
