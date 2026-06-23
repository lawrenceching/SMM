import type { RecognizeMediaFilePlan } from '@core/types/RecognizeMediaFilePlan';
import type { RenameFilesPlan } from '@core/types/RenameFilesPlan';
import { apiFetch } from '@/lib/apiFetch';

export type Plan = RecognizeMediaFilePlan | RenameFilesPlan;

export interface GetPlansResponseBody {
  data?: { plans: Plan[] };
  error?: string;
}

/**
 * Fetch active (`preparing`/`pending`) plans for a media folder.
 */
export async function getPlans(
  mediaFolderPath: string,
  signal?: AbortSignal,
): Promise<GetPlansResponseBody> {
  const resp = await apiFetch('/api/getPlans', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ mediaFolderPath }),
    signal,
  });

  if (!resp.ok) {
    console.error(`[getPlans] unexpected HTTP status`, {
      url: resp.url,
      status: resp.status,
      statusText: resp.statusText,
    });
    throw new Error(`HTTP Layer Error: ${resp.status} ${resp.statusText}`);
  }

  const data: GetPlansResponseBody = await resp.json();
  if (data.error) {
    console.error(`[getPlans] unexpected response body`, {
      url: resp.url,
      response: data,
    });
  }

  return data;
}
