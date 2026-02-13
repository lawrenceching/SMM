import type { FolderRenameRequestBody, FolderRenameResponseBody } from '@core/types';

export interface RenameFolderParams {
  /**
   * Absolute path of source folder
   */
  from: string;
  /**
   * Absolute path of destination folder
   */
  to: string;
}

export async function renameFolder(params: RenameFolderParams): Promise<FolderRenameResponseBody> {
  const req: FolderRenameRequestBody = {
    from: params.from,
    to: params.to,
  };

  const resp = await fetch('/api/renameFolder', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(req),
  });

  if (!resp.ok) {
    throw new Error(`Failed to rename folder: ${resp.statusText}`);
  }

  const data: FolderRenameResponseBody = await resp.json();
  if (data.error) {
    throw new Error(data.error);
  }

  return data;
}

