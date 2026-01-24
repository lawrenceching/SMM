import type { RecognizeMediaFilePlan } from '@core/types/RecognizeMediaFilePlan';

export interface GetPendingPlansResponseBody {
  data: RecognizeMediaFilePlan[];
  error?: string;
}

export async function getPendingPlans(signal?: AbortSignal): Promise<GetPendingPlansResponseBody> {
  const resp = await fetch('/api/getPendingPlans', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
    signal,
  });

  if (!resp.ok) {
    console.error(`[getPendingPlans] unexpected HTTP status`, {
      url: resp.url,
      status: resp.status,
      statusText: resp.statusText,
      response: resp.text(),
    });
    throw new Error(`HTTP Layer Error: ${resp.status} ${resp.statusText}`);
  }

  const data: GetPendingPlansResponseBody = await resp.json();
  if (data.error) {
    console.error(`[getPendingPlans] unexpected response body`, {
      url: resp.url,
      status: resp.status,
      statusText: resp.statusText,
      response: data,
    });
  } else if (!data.data) {
    console.error(`[getPendingPlans] unexpected response body: no data`, {
      url: resp.url,
      status: resp.status,
      statusText: resp.statusText,
      response: data,
    });
  }

  return data;
}
