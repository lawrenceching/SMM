export type UpdatePlanStatus = 'rejected' | 'completed';

export interface UpdatePlanResponseBody {
  data?: { success: boolean };
  error?: string;
}

export async function updatePlan(
  planId: string,
  status: UpdatePlanStatus,
  signal?: AbortSignal
): Promise<UpdatePlanResponseBody> {
  const resp = await fetch('/api/updatePlan', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ planId, status }),
    signal,
  });

  if (!resp.ok) {
    console.error(`[updatePlan] unexpected HTTP status`, {
      url: resp.url,
      status: resp.status,
      statusText: resp.statusText,
      response: resp.text(),
    });
    throw new Error(`HTTP Layer Error: ${resp.status} ${resp.statusText}`);
  }

  const data: UpdatePlanResponseBody = await resp.json();
  if (data.error) {
    console.error(`[updatePlan] unexpected response body`, {
      url: resp.url,
      status: resp.status,
      statusText: resp.statusText,
      response: data,
    });
  } else if (!data.data) {
    console.error(`[updatePlan] unexpected response body: no data`, {
      url: resp.url,
      status: resp.status,
      statusText: resp.statusText,
      response: data,
    });
  }

  return data;
}
