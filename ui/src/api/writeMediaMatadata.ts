import type { MediaMetadata } from "@core/types";
import type { WriteMediaMetadataRequestBody } from "@core/types";


export async function writeMediaMetadata(mediaMetadata: MediaMetadata): Promise<void> {
  const req: WriteMediaMetadataRequestBody = {
    data: mediaMetadata,
  }

  const resp = await fetch('/api/writeMediaMetadata', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(req),
  });

  if (!resp.ok) {
    throw new Error(`Failed to write media metadata: ${resp.statusText}`);
  }

}