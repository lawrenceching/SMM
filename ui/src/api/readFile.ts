import type { ReadFileRequestBody, ReadFileResponseBody, UserConfig } from '@core/types';


export async function readFile(path: string): Promise<ReadFileResponseBody> {
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
    console.error(`[readFile] unexpected HTTP status`, {
      url: resp.url,
      status: resp.status,
      statusText: resp.statusText,
      request: req,
      response: resp.text(),
    });
    throw new Error(`HTTP Layer Error: ${resp.status} ${resp.statusText}`);
  }

  const data: ReadFileResponseBody = await resp.json();
  if (data.error) {
    console.error(`[readFile] unexpected response body`, {
      url: resp.url,
      status: resp.status,
      statusText: resp.statusText,
      request: req,
      response: data,
    });
  } else if(!data.data) {
    console.error(`[readFile] unexpected response body: no data`, {
      url: resp.url,
      status: resp.status,
      statusText: resp.statusText,
      request: req,
      response: data,
    });
  }

  return data;
}

/**
 * TODO: deprecate this method, I can't understand why it return UserConfig
 * @deprecated 
 * @param path 
 * @returns 
 */
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