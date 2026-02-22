import type { DeleteFileRequestBody, DeleteFileResponseBody } from '@core/types';

export async function deleteFile(path: string): Promise<DeleteFileResponseBody> {
  const req: DeleteFileRequestBody = {
    path: path,
  };

  const resp = await fetch('/api/deleteFile', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(req),
  });

  if (!resp.ok) {
    console.error(`[deleteFile] unexpected HTTP status`, {
      url: resp.url,
      status: resp.status,
      statusText: resp.statusText,
      request: req,
      response: resp.text(),
    });
    throw new Error(`HTTP Layer Error: ${resp.status} ${resp.statusText}`);
  }

  const data: DeleteFileResponseBody = await resp.json();
  if (data.error) {
    console.error(`[deleteFile] unexpected response body`, {
      url: resp.url,
      status: resp.status,
      statusText: resp.statusText,
      request: req,
      response: data,
    });
  }

  if (!data.data) {
    console.error(`[deleteFile] unexpected response body: no data`, {
      url: resp.url,
      status: resp.status,
      statusText: resp.statusText,
      request: req,
      response: data,
    });
  }

  return data;
}
