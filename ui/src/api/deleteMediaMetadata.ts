import type { DeleteMediaMetadataRequestBody, DeleteMediaMetadataResponseBody } from '@core/types';

/**
 * Delete media metadata by folder path
 * @param path POSIX format path (mediaFolderPath from MediaMetadata)
 */
export async function deleteMediaMetadata(path: string): Promise<void> {
  const req: DeleteMediaMetadataRequestBody = {
    path: path,
  };

  const resp = await fetch('/api/deleteMediaMetadata', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(req),
  });

  if (!resp.ok) {
    throw new Error(`Failed to delete media metadata: ${resp.statusText}`);
  }

  const data: DeleteMediaMetadataResponseBody = await resp.json();
  if (data.error) {
    throw new Error(`Failed to delete media metadata: ${data.error}`);
  }
}
