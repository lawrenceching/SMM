import type { WriteFileRequestBody, WriteFileResponseBody } from '@core/types';

/**
 * 
 * @param path The absolute path in platform-specific format
 * @param content 
 */
async function writeFile(path: string, content: string): Promise<void> {

  const req: WriteFileRequestBody = {
    path: path,
    data: content,
  }

  const resp = await fetch('/api/writeFile', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(req),
  })

  const data: WriteFileResponseBody = await resp.json();
  
  // Check for error in response body (works for both 200 and 400 status codes)
  if (data.error) {
    throw new Error(data.error);
  }

  // Fallback check for non-OK status codes (like 500)
  if (!resp.ok) {
    throw new Error(`Failed to write file: ${resp.statusText}`);
  }

}

export { writeFile };