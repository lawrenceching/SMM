import { type UIPlan } from '@/stores/plansStore'
import { getPendingPlans } from '@/api/getPendingPlans'
import type { UIRecognizeMediaFilePlan } from '@/types/UIRecognizeMediaFilePlan'
import type { UIRenameFilesPlan } from '@/types/UIRenameFilesPlan'
import { updatePlan as updatePlanApi } from '@/api/updatePlan'

export async function fetchPlans(): Promise<UIPlan[]> {
  try {
    const response = await getPendingPlans()
    if (response.error) {
      console.error('[fetchPlans] Error fetching plans:', response.error)
      return []
    }

    const recognizePlans = (response.data?.map(plan => ({ ...plan, tmp: false })) ?? []) as UIRecognizeMediaFilePlan[]
    const renamePlans = (response.renamePlans?.map(plan => ({ ...plan, tmp: false })) ?? []) as UIRenameFilesPlan[]

    return [...recognizePlans, ...renamePlans]
  } catch (error) {
    console.error('[fetchPlans] Failed to fetch plans:', error)
    return [];
  }
}

export async function savePlan(plan: UIPlan, callback: {
    onSuccess: (plan: UIPlan) => void,
    onError: (error: Error) => void,
}) {
    try {
        await updatePlanApi(plan.id, plan.status === 'completed' ? 'completed' : 'rejected')
        callback.onSuccess(plan)
    } catch (error) {
        console.error('[savePlan] Failed to save plan:', error)
        callback.onError(error as Error)
    }
}