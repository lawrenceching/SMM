import type { PlanStatus } from '@core/types/planCommon';
import type { RecognizedFile } from '@core/types/RecognizeMediaFilePlan';
import type { RenameFileEntry } from '@core/types/RenameFilesPlan';
import type { Plan } from './getPlans';
import { apiFetch } from '@/lib/apiFetch';

export interface UpdatePlanPatch {
  status?: PlanStatus;
  files?: RecognizedFile[] | RenameFileEntry[];
}

export interface UpdatePlanResponseBody {
  data?: { plan: Plan };
  error?: string;
}

/**
 * Patch a plan's `status` and/or `files`. Terminal statuses
 * (`completed`/`rejected`) cause the backend to delete the plan file.
 */
export async function updatePlan(
  id: string,
  patch: UpdatePlanPatch,
  signal?: AbortSignal,
): Promise<UpdatePlanResponseBody> {
  const resp = await apiFetch('/api/updatePlan', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ id, ...patch }),
    signal,
  });

  if (!resp.ok) {
    console.error(`[updatePlan] unexpected HTTP status`, {
      url: resp.url,
      status: resp.status,
      statusText: resp.statusText,
    });
    throw new Error(`HTTP Layer Error: ${resp.status} ${resp.statusText}`);
  }

  const data: UpdatePlanResponseBody = await resp.json();
  if (data.error) {
    console.error(`[updatePlan] unexpected response body`, {
      url: resp.url,
      response: data,
    });
  }

  return data;
}
