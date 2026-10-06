import { getCore } from '@smm/server'
import { planFileCount } from '../planFormat'

export async function apply(planId: string): Promise<number> {
  try {
    const plan = await getCore().getPlan(planId)
    await getCore().applyPlan(plan)
    console.log(`applied ${plan.id} (${planFileCount(plan)} file(s))`)
    return 0
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    return 1
  }
}
