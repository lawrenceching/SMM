import type { Plan } from './getPlans'
import { rpc, unwrapJson } from '@/lib/rpc'

export interface RejectPlanRequest {
  id: string
}

/** POST /api/reject-plan — reject a plan by id (file kept with status rejected). */
export async function rejectPlan(
  request: RejectPlanRequest,
  signal?: AbortSignal,
): Promise<Plan> {
  const resp = await rpc.api['reject-plan'].$post(
    { json: request },
    { init: { signal } },
  )
  const body = await unwrapJson(resp)
  if ('error' in body) {
    throw new Error(body.error)
  }
  return body.data.plan
}
