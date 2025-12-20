import { existedFileError } from "@core/errors";

/**
 * Download the image to the destination file path
 * @param url The image URL
 * @param dest The destination file path, in platform format
 * @returns Promise<void>
 */
export async function downloadImage(url: string, dest: string): Promise<void> {
  // Check if destination file already exists
  const fileExists = await Bun.file(dest).exists();
  console.log(`[downloadImage] File exists: ${fileExists}`);
  if (fileExists) {
    throw new Error(existedFileError(dest));
  }

  // Handle protocol-relative URLs (starting with //)
  let normalizedUrl = url;
  if (url.startsWith("//")) {
    normalizedUrl = `https:${url}`;
  }

  // Validate URL
  if (!normalizedUrl.startsWith("http://") && !normalizedUrl.startsWith("https://")) {
    throw new Error(`Invalid image URL: ${url}. Must be http://, https://, or protocol-relative (//)`);
  }

  try {
    console.log(`[downloadImage] Downloading image from ${normalizedUrl} to ${dest}`);

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

    // Download as binary
    const arrayBuffer = await response.arrayBuffer();
    await Bun.write(dest, arrayBuffer);

    console.log(`[downloadImage] Successfully downloaded image to ${dest} (${arrayBuffer.byteLength} bytes)`);
  } catch (error) {
    console.error(`[downloadImage] Error downloading image from ${normalizedUrl}:`, error);
    throw error;
  }
}