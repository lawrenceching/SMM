import type { RecognizeMediaFilePlan } from '@core/types/RecognizeMediaFilePlan'
import { getPlanById } from '@/api/getPlanById'
import { getPlanDraft, setPlanDraft } from './aiPlanDrafts'

/**
 * Resolve a recognize-media-file plan from the in-memory draft, or
 * rehydrate it from disk when the draft was lost (page refresh, mixed
 * frontend/backend tool execution).
 */
export async function resolveRecognizePlanDraft(
  planId: string,
): Promise<RecognizeMediaFilePlan | null> {
  const normalizedId = planId.trim()
  const draft = getPlanDraft(normalizedId)
  if (draft?.task === 'recognize-media-file') {
    return draft
  }

  const resp = await getPlanById(normalizedId)
  if (
    resp.error ||
    !resp.data?.plan ||
    resp.data.plan.task !== 'recognize-media-file'
  ) {
    return null
  }

  const plan = resp.data.plan as RecognizeMediaFilePlan
  setPlanDraft(plan)
  return plan
}
