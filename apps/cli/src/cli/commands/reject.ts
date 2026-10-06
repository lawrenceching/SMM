import { getCore } from '@smm/server'

export async function reject(planId: string): Promise<number> {
  try {
    const plan = await getCore().rejectPlan(planId)
    console.log(`rejected ${plan.id}`)
    return 0
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    return 1
  }
}
