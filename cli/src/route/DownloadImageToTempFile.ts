import { join } from "path";
import { tmpdir } from "os";
import { writeFile } from "fs/promises";
import { Path } from "@core/path";



/**
 * Downloads an image from an HTTP/HTTPS URL and saves it to a temporary file
 * @param url The image URL (can be http://, https://, or protocol-relative //)
 * @returns Promise<string> The path to the temporary file in POSIX format
 */
export default async function downloadImageToTemp(url: string): Promise<string> {
  // Handle protocol-relative URLs (starting with //)
  let normalizedUrl = url;
  if (url.startsWith("//")) {
    normalizedUrl = `https:${url}`;
  }

  // Validate URL
  if (!normalizedUrl.startsWith("http://") && !normalizedUrl.startsWith("https://")) {
    throw new Error(`Invalid image URL: ${url}. Must be http://, https://, or protocol-relative (//)`);
  }

  // Determine file extension from URL
  let fileExtension = "jpg"; // default
  try {
    const urlPath = new URL(normalizedUrl).pathname.toLowerCase();
    const match = urlPath.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg|tiff|tif)$/);
    if (match && match[1]) {
      fileExtension = match[1];
      // Normalize jpeg to jpg
      if (fileExtension === "jpeg") {
        fileExtension = "jpg";
      }
    }
  } catch (error) {
    console.warn(`[DownloadImageToTemp] Failed to parse URL for extension: ${error}`);
  }

  // Generate a unique temporary file path
  const tempFileName = `image-${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExtension}`;
  const outputPath = join(tmpdir(), tempFileName);

  try {
    console.log(`[DownloadImageToTemp] Downloading image from ${normalizedUrl} to ${outputPath}`);

    const response = await fetch(normalizedUrl, {
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

    // Get content type to determine extension if not found in URL
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.startsWith("image/")) {
      const mimeTypePart = contentType.split(";")[0];
      if (mimeTypePart) {
        const mimeType = mimeTypePart.trim();
        const mimeToExt: Record<string, string> = {
          "image/jpeg": "jpg",
          "image/jpg": "jpg",
          "image/png": "png",
          "image/gif": "gif",
          "image/webp": "webp",
          "image/bmp": "bmp",
          "image/svg+xml": "svg",
          "image/tiff": "tiff",
        };
        if (mimeToExt[mimeType]) {
          fileExtension = mimeToExt[mimeType];
          console.debug(`[DownloadImageToTemp] Detected MIME type: ${mimeType}, extension: ${fileExtension}`);
        }
      }
    }

    // Download as binary
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await writeFile(outputPath, buffer);

    // Convert to POSIX format for return
    const posixPath = new Path(outputPath).abs();
    console.log(`[DownloadImageToTemp] Successfully downloaded image to ${posixPath}`);
    return posixPath;
  } catch (error) {
    console.error(`[DownloadImageToTemp] Error downloading image from ${normalizedUrl}:`, error);
    throw error;
  }
}

