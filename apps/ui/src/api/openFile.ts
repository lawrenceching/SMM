import type { OpenFileRequestBody, OpenFileResponseBody } from '@core/types';

const OPEN_FILE_CHANNEL = 'open-file';

function getElectronApi():
  | { executeChannel: (request: { name: string; data: string }) => Promise<{ name: string; data: unknown }> }
  | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }

  return (window as Window & { api?: { executeChannel: typeof Function } }).api as
    | { executeChannel: (request: { name: string; data: string }) => Promise<{ name: string; data: unknown }> }
    | undefined;
}

function formatOpenFileError(error: unknown): string | undefined {
  if (error == null) {
    return undefined;
  }
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return String(error);
}

function mapExecuteChannelResponse(
  response: { name: string; data: unknown },
  path: string,
): OpenFileResponseBody {
  const data = response.data as { success?: boolean; error?: unknown } | undefined;
  if (data?.success) {
    return { data: { path } };
  }

  const error = formatOpenFileError(data?.error);
  return error ? { data: { path }, error } : { data: { path } };
}

export async function openFile(path: string): Promise<OpenFileResponseBody> {
  const api = getElectronApi();

  if (api?.executeChannel) {
    const response = await api.executeChannel({
      name: OPEN_FILE_CHANNEL,
      data: path,
    });
    return mapExecuteChannelResponse(response, path);
  }

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
