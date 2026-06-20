import type { PlanCreator } from '@core/types/planCommon';
import type { Plan } from './getPlans';

export interface CreatePlanRequest {
  /** Optional client-supplied UUID so the caller can reference the plan immediately. */
  id?: string;
  task: 'recognize-media-file' | 'rename-files';
  mediaFolderPath: string;
  creator: PlanCreator;
}

export interface CreatePlanResponseBody {
  data?: { plan: Plan };
  error?: string;
}

/**
 * Create a new plan in `preparing` status.
 */
export async function createPlan(
  request: CreatePlanRequest,
  signal?: AbortSignal,
): Promise<CreatePlanResponseBody> {
  const resp = await fetch('/api/createPlan', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
    signal,
  });

  if (!resp.ok) {
    console.error(`[createPlan] unexpected HTTP status`, {
      url: resp.url,
      status: resp.status,
      statusText: resp.statusText,
    });
    throw new Error(`HTTP Layer Error: ${resp.status} ${resp.statusText}`);
  }

  const data: CreatePlanResponseBody = await resp.json();
  if (data.error) {
    console.error(`[createPlan] unexpected response body`, {
      url: resp.url,
      response: data,
    });
  }

  return data;
}
