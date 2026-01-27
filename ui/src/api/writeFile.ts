import type { WriteFileRequestBody, WriteFileResponseBody } from '@core/types';

/**
 * Writes content to a file
 * @param path The absolute path in platform-specific format
 * @param content The content to write
 * @param traceId Optional trace ID for request tracking (full trace ID string with event name, e.g., "AiSettings-1294")
 */
async function writeFile(path: string, content: string, traceId?: string): Promise<void> {
  if (traceId) {
    console.log(`[${traceId}] writeFile: Writing to ${path}`);
  }

  const req: WriteFileRequestBody = {
    path: path,
    data: content,
    mode: 'overwrite',
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (traceId) {
    // Send full trace ID string in HTTP header (not just numeric counter)
    headers['X-Trace-Id'] = traceId;
  }

  const resp = await fetch('/api/writeFile', {
    method: 'POST',
    headers,
    body: JSON.stringify(req),
  });

  const data: WriteFileResponseBody = await resp.json();

  if (traceId) {
    console.log(`[${traceId}] writeFile: Response received`, data);
  }

  // Check for error in response body (works for both 200 and 400 status codes)
  if (data.error) {
    console.error(`[${traceId}] writeFile: Error in response: ${data.error}`);
    throw new Error(data.error);
  }

  // Fallback check for non-OK status codes (like 500)
  if (!resp.ok) {
    console.error(`[${traceId}] writeFile: HTTP error ${resp.status}: ${resp.statusText}`);
    throw new Error(`Failed to write file: ${resp.statusText}`);
  }
}

export { writeFile };
