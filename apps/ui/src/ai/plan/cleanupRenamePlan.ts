import { deletePlanDraft } from './aiPlanDrafts'

export async function cleanupRenamePlan(planId: string): Promise<void> {
  deletePlanDraft(planId)
}
