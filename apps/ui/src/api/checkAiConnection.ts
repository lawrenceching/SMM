interface CheckAiConnectionRequest {
  ai: string;
  model: string;
  apiKey: string;
  baseURL: string;
}

interface CheckAiConnectionResponse {
  ai: string;
  model: string;
  status: string;
}

export async function checkAiConnection(ai: string, model: string, apiKey: string, baseURL: string): Promise<CheckAiConnectionResponse> {
  const req: CheckAiConnectionRequest = { ai, model, apiKey, baseURL };

  const resp = await fetch('/api/ai/check', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(req),
  });

  if (!resp.ok) {
    const errorBody = await resp.json().catch(() => ({}));
    throw new Error(errorBody.error || `HTTP ${resp.status} ${resp.statusText}`);
  }

  return resp.json();
}
