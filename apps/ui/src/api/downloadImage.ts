import { Path } from "@core/path";
import type { DownloadImageRequestBody, DownloadImageResponseBody } from "@core/types";

export async function downloadImageApi(url: string, pathInPosix: string): Promise<DownloadImageResponseBody> {
  const req: DownloadImageRequestBody = {
    url: url,
    path: Path.toPlatformPath(pathInPosix),
  }
  const resp = await fetch('/api/downloadImage', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(req),
  });

  return (await resp.json()) as DownloadImageResponseBody;
}