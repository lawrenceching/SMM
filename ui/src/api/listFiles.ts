import type { ListFilesRequestBody, ListFilesResponseBody } from "@core/types";

export async function listFiles(req: ListFilesRequestBody): Promise<ListFilesResponseBody> {
  const resp = await fetch('/api/listFiles', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(req),
  });

  if (!resp.ok) {
    console.error(`[listFiles] unexpected HTTP status`, {
      url: resp.url,
      status: resp.status,
      statusText: resp.statusText,
      request: req,
      response: resp.text(),
    });
    throw new Error(`HTTP Layer Error: ${resp.status} ${resp.statusText}`);
  }

  const data: ListFilesResponseBody = await resp.json();
  if (data.error) {
    console.error(`[listFiles] unexpected response body`, {
      url: resp.url,
      status: resp.status,
      statusText: resp.statusText,
      request: req,
      response: data,
    });
  }

  if (!data.data) {
    console.error(`[listFiles] unexpected response body: no data`, {
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
 * List files and folders in a directory
 * @param path platform-specific path (supports "~" for home directory)
 * @param options optional filters
 */
export async function listFilesApi(
  path: string,
  options?: {
    onlyFiles?: boolean;
    onlyFolders?: boolean;
    includeHiddenFiles?: boolean;
  }
): Promise<ListFilesResponseBody> {
  const req: ListFilesRequestBody = {
    path: path,
    onlyFiles: options?.onlyFiles,
    onlyFolders: options?.onlyFolders,
    includeHiddenFiles: options?.includeHiddenFiles,
  };

  const resp = await fetch('/api/listFiles', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(req),
  });

  if (!resp.ok) {
    console.error(`[listFilesApi] unexpected HTTP status`, {
      url: resp.url,
      status: resp.status,
      statusText: resp.statusText,
      request: req,
      response: resp.text(),
    });
    throw new Error(`HTTP Layer Error: ${resp.status} ${resp.statusText}`);
  }

  const data: ListFilesResponseBody = await resp.json();
  if (data.error) {
    console.error(`[listFilesApi] unexpected response body`, {
      url: resp.url,
      status: resp.status,
      statusText: resp.statusText,
      request: req,
      response: data,
    });
  }

  if (!data.data) {
    console.error(`[listFilesApi] unexpected response body: no data`, {
      url: resp.url,
      status: resp.status,
      statusText: resp.statusText,
      request: req,
      response: data,
    });
  }

  return data;
}

