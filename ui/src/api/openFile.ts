import type { OpenFileRequestBody, OpenFileResponseBody } from '@core/types';

export async function openFile(path: string): Promise<OpenFileResponseBody> {
  const req: OpenFileRequestBody = {
    path: path,
  };

  const resp = await fetch('/api/openFile', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(req),
  });

  if (!resp.ok) {
    console.error(`[openFile] unexpected HTTP status`, {
      url: resp.url,
      status: resp.status,
      statusText: resp.statusText,
      request: req,
      response: resp.text(),
    });
    throw new Error(`HTTP Layer Error: ${resp.status} ${resp.statusText}`);
  }

  const data: OpenFileResponseBody = await resp.json();
  if (data.error) {
    console.error(`[openFile] unexpected response body`, {
      url: resp.url,
      status: resp.status,
      statusText: resp.statusText,
      request: req,
      response: data,
    });
  }

  if (!data.data) {
    console.error(`[openFile] unexpected response body: no data`, {
      url: resp.url,
      status: resp.status,
      statusText: resp.statusText,
      request: req,
      response: data,
    });
  }

  return data;
}
