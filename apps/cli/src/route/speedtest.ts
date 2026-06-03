import type { Hono } from 'hono';

const ALLOWED_HOSTNAMES = new Set([
  'github.com',
  'gitcode.com',
]);

const SPEEDTEST_TIMEOUT_MS = 5_000;

interface SpeedtestResult {
  url: string;
  timeMs: number | null;
  error?: string;
}

interface SpeedtestResponse {
  fastestUrl: string;
  results: SpeedtestResult[];
}

/**
 * Validate that all URLs in the list are from allowed domains.
 */
function validateUrls(urls: string[]): string | null {
  if (!Array.isArray(urls) || urls.length === 0) {
    return 'urls must be a non-empty array';
  }

  for (const url of urls) {
    if (typeof url !== 'string') {
      return 'each url must be a string';
    }

    let hostname: string;
    try {
      hostname = new URL(url).hostname.toLowerCase();
    } catch {
      return `invalid URL: ${url}`;
    }

    // Allow exact match or subdomain match (e.g. www.github.com, api.github.com)
    if (!ALLOWED_HOSTNAMES.has(hostname) && !hostname.endsWith('.github.com') && !hostname.endsWith('.gitcode.com')) {
      return `URL not allowed: ${url}. Only github.com and gitcode.com domains are permitted.`;
    }
  }

  return null;
}

/**
 * Test a single URL and measure response time.
 */
async function testUrl(url: string): Promise<SpeedtestResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SPEEDTEST_TIMEOUT_MS);

  const start = performance.now();
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'follow',
    });

    // Even if the response is not ok (e.g. 404, 500), we still measure reachability
    // By default we just care about whether the server responds at all
    const timeMs = performance.now() - start;

    return {
      url,
      timeMs: Math.round(timeMs),
    };
  } catch (error) {
    const timeMs = performance.now() - start;
    return {
      url,
      timeMs: Math.round(timeMs),
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function handleSpeedtest(app: Hono) {
  app.post('/api/speedtest', async (c) => {
    let body: { urls?: unknown };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'Invalid JSON body' }, 400);
    }

    const urls = body.urls;
    if (!Array.isArray(urls)) {
      return c.json({ error: 'urls must be an array' }, 400);
    }

    const validationError = validateUrls(urls);
    if (validationError) {
      return c.json({ error: validationError }, 400);
    }

    // Run all tests in parallel
    const results = await Promise.all(urls.map((url) => testUrl(url as string)));

    // Pick the fastest URL (prefer one without error, then fastest time)
    const successfulResults = results.filter((r) => !r.error);
    let fastestUrl: string;

    if (successfulResults.length === 0) {
      // All URLs failed — return the first URL as fallback, include error info
      fastestUrl = urls[0] as string;
    } else {
      // Sort by timeMs ascending, pick the fastest
      successfulResults.sort((a, b) => (a.timeMs ?? Infinity) - (b.timeMs ?? Infinity));
      fastestUrl = successfulResults[0].url;
    }

    const response: SpeedtestResponse = {
      fastestUrl,
      results,
    };

    return c.json(response);
  });
}
