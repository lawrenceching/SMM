import { rpc, unwrapJson } from '@/lib/rpc'

export interface ApplyPlanRequest {
  id: string
  /** UC3: apply only the selected "from" files of a rename-files plan. */
  data?: { files?: string[] }
}

/** POST /api/apply-plan — apply a pending plan by id. */
export async function applyPlan(
  request: ApplyPlanRequest,
  signal?: AbortSignal,
): Promise<{ id: string }> {
  const resp = await rpc.api['apply-plan'].$post(
    { json: request },
    { init: { signal } },
  )
  if (!resp.ok) {
    throw new Error(`Failed to apply-plan: ${resp.statusText}`)
  }
  const body = await unwrapJson(resp)
  if ('error' in body) {
    throw new Error(body.error)
  }
  return body.data
}
