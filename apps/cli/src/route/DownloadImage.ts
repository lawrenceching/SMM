import type { Hono } from 'hono';
import { logger } from '../../lib/logger';
import { allowRead } from '../utils/permission';
import { readFile } from 'fs/promises';
import { extname } from 'path';

function normalizeUrl(url: string): string {
  if (url.startsWith("//")) {
    return `https:${url}`;
  }
  return url;
}

function createImageResponse(buffer: Buffer, contentType: string): Response {
  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Length": buffer.length.toString(),
      "Cache-Control": "public, max-age=31536000",
    },
  });
}

async function downloadImageFromFile(filePath: string): Promise<Response> {
  console.log(`[DownloadImage] Reading file from ${filePath}`);

  const isAllowed = await allowRead(filePath);
  if (!isAllowed) {
    throw new Error(`Permission denied: file ${filePath} is not allowed to be read`);
  }

  const buffer = await readFile(filePath);
  const ext = extname(filePath).toLowerCase();
  const contentType = getContentType(ext);

  console.log(`[DownloadImage] Successfully read file (${buffer.length} bytes, content-type: ${contentType})`);

  return createImageResponse(buffer, contentType);
}

async function downloadImageFromWeb(url: string): Promise<Response> {
  console.log(`[DownloadImage] Downloading image from ${url}`);

  const response = await fetch(url, {
    headers: {
      "accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      "accept-language": "en-US,en;q=0.9",
      "cache-control": "no-cache",
      "sec-fetch-dest": "image",
      "sec-fetch-mode": "no-cors",
      "sec-fetch-site": "cross-site",
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
    method: "GET",
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const contentType = response.headers.get("content-type") || "image/jpeg";
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  console.log(`[DownloadImage] Successfully downloaded image (${buffer.length} bytes, content-type: ${contentType})`);

  return createImageResponse(buffer, contentType);
}

function getContentType(ext: string): string {
  const contentTypes: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.bmp': 'image/bmp',
    '.avif': 'image/avif',
    '.apng': 'image/apng',
  };
  return contentTypes[ext] || 'image/jpeg';
}

/**
 * Downloads an image from an HTTP/HTTPS URL or file path and returns it as an HTTP response
 * @param url The image URL (can be http://, https://, protocol-relative //, or file://)
 * @returns Promise<Response> The image as an HTTP response with proper content-type
 */
export async function doDownloadImage(url: string): Promise<Response> {
  const normalizedUrl = normalizeUrl(url);

  try {
    if (normalizedUrl.startsWith("file://")) {
      const filePath = decodeURIComponent(normalizedUrl.slice(7));
      return await downloadImageFromFile(filePath);
    }

    if (normalizedUrl.startsWith("http://") || normalizedUrl.startsWith("https://")) {
      return await downloadImageFromWeb(normalizedUrl);
    }

    throw new Error(`Invalid image URL: ${url}. Must be http://, https://, protocol-relative (//), or file://`);
  } catch (error) {
    console.error(`[DownloadImage] Error downloading image from ${normalizedUrl}:`, error);
    throw error;
  }
}

export function handleDownloadImage(app: Hono) {
  // GET /api/image?url=xxxx - Download and return image from URL
  app.get('/api/image', async (c) => {
    try {
      const url = c.req.query('url');
      
      if (!url) {
        return c.json({ 
          error: 'Missing required query parameter: url'
        }, 400);
      }

      const imageResponse = await doDownloadImage(url);
      return imageResponse;
    } catch (error) {
      logger.error({ error }, 'DownloadImage route error:');
      return c.json({ 
        error: `Failed to download image: ${error instanceof Error ? error.message : 'Unknown error'}`
      }, 500);
    }
  });
}
