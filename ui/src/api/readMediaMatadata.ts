import type { MediaMetadata } from "@core/types";
import type { ReadMediaMetadataRequestBody, ReadMediaMetadataResponseBody } from "@core/types";


/**
 * 
 * @param path platform-specific path
 */
export async function readMediaMetadataApi(path: string): Promise<ReadMediaMetadataResponseBody> {
  const req: ReadMediaMetadataRequestBody = {
    path: path,
  }

  const resp = await fetch('/api/readMediaMetadata', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(req),
  });

  if (!resp.ok) {
    throw new Error(`Failed to read media metadata: ${resp.statusText}`);
  }

  const data: ReadMediaMetadataResponseBody = await resp.json();
  return data;
}