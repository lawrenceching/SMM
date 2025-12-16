/**
 * Downloads an image from an HTTP/HTTPS URL and returns it as an HTTP response
 * @param url The image URL (can be http://, https://, or protocol-relative //)
 * @returns Promise<Response> The image as an HTTP response with proper content-type
 */
export async function handleDownloadImage(url: string): Promise<Response> {
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
    console.log(`[DownloadImage] Downloading image from ${normalizedUrl}`);

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

    // Get content type from response, default to image/jpeg if not available
    const contentType = response.headers.get("content-type") || "image/jpeg";

    // Get the image data as array buffer
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log(`[DownloadImage] Successfully downloaded image (${buffer.length} bytes, content-type: ${contentType})`);

    // Return the image as an HTTP response with proper content-type
    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": buffer.length.toString(),
        "Cache-Control": "public, max-age=31536000", // Cache for 1 year
      },
    });
  } catch (error) {
    console.error(`[DownloadImage] Error downloading image from ${normalizedUrl}:`, error);
    throw error;
  }
}
