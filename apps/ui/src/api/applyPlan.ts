import { apiFetch } from '@/lib/apiFetch'

export interface ApplyPlanRequest {
  id: string
}

export interface ApplyPlanResponseBody {
  data?: { id: string }
  error?: string
}

/** POST /api/apply-plan — apply a pending plan by id. */
export async function applyPlan(
  request: ApplyPlanRequest,
  signal?: AbortSignal,
): Promise<ApplyPlanResponseBody> {
  const resp = await apiFetch('/api/apply-plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
    signal,
  })

  if (!resp.ok) {
    throw new Error(`Failed to apply-plan: ${resp.statusText}`)
  }

  return (await resp.json()) as ApplyPlanResponseBody
}
