export interface SpeedtestResult {
  url: string;
  timeMs: number | null;
  error?: string;
}

export interface SpeedtestResponse {
  fastestUrl: string;
  results: SpeedtestResult[];
}

/**
 * Call the CLI speedtest endpoint to determine which URL responds faster.
 * The result should be cached in localStorage for use by the DVD guide link.
 */
export async function speedtest(urls: string[]): Promise<SpeedtestResponse> {
  const resp = await fetch('/api/speedtest', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ urls }),
  });

  if (!resp.ok) {
    const errorBody = await resp.json().catch(() => ({}));
    throw new Error(errorBody.error || `HTTP ${resp.status} ${resp.statusText}`);
  }

  return resp.json();
}
