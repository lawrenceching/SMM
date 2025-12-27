import type { FileRenameRequestBody, FileRenameResponseBody } from '@core/types';

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

export async function renameFile(params: RenameFileParams): Promise<FileRenameResponseBody> {
  const req: FileRenameRequestBody = {
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

  const data: FileRenameResponseBody = await resp.json();
  if (data.error) {
    throw new Error(data.error);
  }

  return data;
}

