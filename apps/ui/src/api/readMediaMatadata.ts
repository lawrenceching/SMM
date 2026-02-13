import type { ReadMediaMetadataRequestBody, ReadMediaMetadataResponseBody } from "@core/types";

/**
 * 
 * @param path platform-specific path
 * @param signal optional AbortSignal to cancel the request
 */
export async function readMediaMetadataApi(path: string, signal?: AbortSignal): Promise<ReadMediaMetadataResponseBody> {
  const req: ReadMediaMetadataRequestBody = {
    path: path,
  }

  const resp = await fetch('/api/readMediaMetadata', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(req),
    signal,
  });

  if (!resp.ok) {
    throw new Error(`HTTP layer error: ${resp.status} ${resp.statusText}`);
  }

  const data: ReadMediaMetadataResponseBody = await resp.json();
  return data;
}