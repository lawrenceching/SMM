import type { ScrapeRequestBody, ScrapeResponseBody } from "@core/types";

/**
 * Scrape media files (poster, thumbnails, nfo) for a media folder
 * @param mediaFolderPath - The absolute path to the media folder (in POSIX format)
 */
export async function scrapeApi(mediaFolderPath: string): Promise<ScrapeResponseBody> {
  const req: ScrapeRequestBody = {
    mediaFolderPath: mediaFolderPath,
  }

  const resp = await fetch('/api/scrape', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(req),
  });

  if (!resp.ok) {
    throw new Error(`Failed to scrape media: ${resp.statusText}`);
  }

  const data: ScrapeResponseBody = await resp.json();
  return data;
}

