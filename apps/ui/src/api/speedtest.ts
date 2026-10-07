import { rpc } from '@/lib/rpc';

type SpeedtestHttpResponseBody = Awaited<
  ReturnType<Awaited<ReturnType<(typeof rpc)['api']['speedtest']['$post']>>['json']>
>;

export type SpeedtestResponse = Exclude<SpeedtestHttpResponseBody, { error: string }>;

/**
 * Call the CLI speedtest endpoint to determine which URL responds faster.
 * The result should be cached in localStorage for use by the DVD guide link.
 */
export async function speedtest(urls: string[]): Promise<SpeedtestResponse> {
  const resp = await rpc.api.speedtest.$post({ json: { urls } });

  if (!resp.ok) {
    const errorBody = await resp.json().catch(() => null);
    if (errorBody !== null && typeof errorBody === 'object' && 'error' in errorBody) {
      throw new Error(errorBody.error);
    }
    throw new Error(`HTTP ${resp.status} ${resp.statusText}`);
  }

  const body = await resp.json();
  if ('error' in body) {
    throw new Error(body.error);
  }
  return body;
}
