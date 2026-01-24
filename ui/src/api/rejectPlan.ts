export interface RejectPlanResponseBody {
  data?: { success: boolean };
  error?: string;
}

export async function rejectPlan(planId: string, signal?: AbortSignal): Promise<RejectPlanResponseBody> {
  const resp = await fetch('/api/rejectPlan', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ planId }),
    signal,
  });

  if (!resp.ok) {
    console.error(`[rejectPlan] unexpected HTTP status`, {
      url: resp.url,
      status: resp.status,
      statusText: resp.statusText,
      response: resp.text(),
    });
    throw new Error(`HTTP Layer Error: ${resp.status} ${resp.statusText}`);
  }

  const data: RejectPlanResponseBody = await resp.json();
  if (data.error) {
    console.error(`[rejectPlan] unexpected response body`, {
      url: resp.url,
      status: resp.status,
      statusText: resp.statusText,
      response: data,
    });
  } else if (!data.data) {
    console.error(`[rejectPlan] unexpected response body: no data`, {
      url: resp.url,
      status: resp.status,
      statusText: resp.statusText,
      response: data,
    });
  }

  return data;
}
