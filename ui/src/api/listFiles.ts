import type { ListFilesRequestBody, ListFilesResponseBody } from "@core/types";

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
    throw new Error(`Failed to list files: ${resp.statusText}`);
  }

  const data: ListFilesResponseBody = await resp.json();
  return data;
}

