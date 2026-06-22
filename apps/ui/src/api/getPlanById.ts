import type { Plan } from './getPlans';

export interface GetPlanByIdResponseBody {
  data?: { plan: Plan };
  error?: string;
}

/**
 * Load a plan file from disk by id. Used when the in-memory AI
 * draft was lost (page refresh) but the plan file still exists.
 */
export async function getPlanById(
  id: string,
  signal?: AbortSignal,
): Promise<GetPlanByIdResponseBody> {
  const resp = await fetch('/api/getPlanById', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ id: id.trim() }),
    signal,
  });

  if (!resp.ok) {
    console.error(`[getPlanById] unexpected HTTP status`, {
      url: resp.url,
      status: resp.status,
      statusText: resp.statusText,
    });
    throw new Error(`HTTP Layer Error: ${resp.status} ${resp.statusText}`);
  }

  return (await resp.json()) as GetPlanByIdResponseBody;
}
