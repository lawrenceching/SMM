import type { Plan } from './getPlans'
import { apiFetch } from '@/lib/apiFetch'

export interface RejectPlanRequest {
  id: string
}

export interface RejectPlanResponseBody {
  data?: { plan: Plan }
  error?: string
}

/** POST /api/reject-plan — reject a plan by id (file kept with status rejected). */
export async function rejectPlan(
  request: RejectPlanRequest,
  signal?: AbortSignal,
): Promise<RejectPlanResponseBody> {
  const resp = await apiFetch('/api/reject-plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
    signal,
  })

  if (!resp.ok) {
    throw new Error(`Failed to reject-plan: ${resp.statusText}`)
  }

  return (await resp.json()) as RejectPlanResponseBody
}
