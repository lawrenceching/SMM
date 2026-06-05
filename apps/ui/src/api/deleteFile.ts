import type { DeleteFileRequestBody, DeleteFileResponseBody } from '@core/types';

export async function deleteFile(path: string): Promise<DeleteFileResponseBody> {
  const req: DeleteFileRequestBody = { path };

  const resp = await fetch('/api/deleteFile', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(req),
  });

  if (!resp.ok) {
    throw new Error(`HTTP Layer Error: ${resp.status} ${resp.statusText}`);
  }

  const data: DeleteFileResponseBody = await resp.json();
  if (data.error) {
    throw new Error(data.error);
  }

  return data;
}
