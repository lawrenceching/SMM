import { downloadImage } from "@/utils/downloadImage";
import type { DownloadImageRequestBody, DownloadImageResponseBody } from "@core/types";
import type { Hono } from "hono";

export function handleDownloadImageAsFileRequest(app: Hono) {
  app.post('/api/downloadImage', async (c) => {
    const body = await c.req.json() as DownloadImageRequestBody;
    console.log(`[DownloadImageAsFile] Downloading image from ${body.url} to ${body.path}`);
    try {
      await downloadImage(body.url, body.path);
      const response: DownloadImageResponseBody = {
        data: {
          url: body.url,
          path: body.path,
        },
      };
      return c.json(response);
    } catch (error) {
      const response: DownloadImageResponseBody = {
        data: {
          url: body.url,
          path: body.path,
        },
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
      return c.json(response);
    }
  });
}