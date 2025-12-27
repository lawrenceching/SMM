import type { NewFileNameRequestBody, GetFileNameResponseBody } from '@core/types';

export async function newFileName(params: NewFileNameRequestBody): Promise<GetFileNameResponseBody> {
  const resp = await fetch('/api/newFileName', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });

  if (!resp.ok) {
    throw new Error(`Failed to generate new file name: ${resp.statusText}`);
  }

  const data: GetFileNameResponseBody = await resp.json();
  if (data.error) {
    throw new Error(data.error);
  }

  return data;
}

