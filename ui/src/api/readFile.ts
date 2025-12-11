import type { ReadFileRequestBody, ReadFileResponseBody, UserConfig } from '@core/types';

async function readFileApi(path: string): Promise<UserConfig> {

  const req: ReadFileRequestBody = {
    path: path,
  }

  const resp = await fetch('/api/readFile', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(req),
  })

  if (!resp.ok) {
    throw new Error(`Failed to read file: ${resp.statusText}`);
  }

  const data: ReadFileResponseBody = await resp.json();
  if (data.error) {
    throw new Error(`Failed to read file: ${data.error}`);
  }

  if(!data.data) {
    throw new Error('Failed to read file: no data');
  }

  return JSON.parse(data.data) as UserConfig;

}

export { readFileApi };