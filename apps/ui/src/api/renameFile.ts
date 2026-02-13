/**
 * Local types for legacy renameFile client.
 * The /api/renameFile and /api/renameFileInBatch endpoints have been removed.
 * Migrate to POST /api/renameFiles and use ui/src/api/renameFiles.ts when available.
 */
export interface RenameFileParams {
  /**
   * Absolute path of media folder
   */
  mediaFolder: string;
  /**
   * Absolute path of source file
   */
  from: string;
  /**
   * Absolute path of destination file
   */
  to: string;
}

interface RenameFileResponseBody {
  error?: string;
}

export async function renameFile(params: RenameFileParams): Promise<RenameFileResponseBody> {
  const req = {
    mediaFolder: params.mediaFolder,
    from: params.from,
    to: params.to,
  };

  const resp = await fetch('/api/renameFile', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(req),
  });

  if (!resp.ok) {
    throw new Error(`Failed to rename file: ${resp.statusText}`);
  }

  const data: RenameFileResponseBody = await resp.json();
  if (data.error) {
    throw new Error(data.error);
  }

  return data;
}

