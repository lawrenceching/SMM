import type { WriteFileRequestBody, WriteFileResponseBody } from '@core/types';

async function writeFile(path: string, content: string): Promise<void> {

  const req: WriteFileRequestBody = {
    path: path,
    data: content,
  }

  const resp = await fetch('/api/writeFile', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(req),
  })

  if (!resp.ok) {
    throw new Error(`Failed to read file: ${resp.statusText}`);
  }

  const data: WriteFileResponseBody = await resp.json();
  if (data.error) {
    throw new Error(`Failed to read file: ${data.error}`);
  }

}

export { writeFile };