interface CheckAiConnectionResponse {
  model: string;
  status: string;
}

export async function checkAiConnection(model: string, apiKey: string, baseURL: string): Promise<CheckAiConnectionResponse> {
  const resp = await fetch('/api/ai/check', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model, apiKey, baseURL }),
  });

  if (!resp.ok) {
    const errorBody = await resp.json().catch(() => ({}));
    throw new Error(errorBody.error || `HTTP ${resp.status} ${resp.statusText}`);
  }

  return resp.json();
}
