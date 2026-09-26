/**
 * Polls the Vite page server (`VITE_PORT`) and the unified CLI HTTP server
 * (`HTTP_PORT`) until both respond, or exits 1 on timeout.
 *
 * Used as the first apps/cicd task for --platform web. A failure here stops
 * later spec tasks (`stopOnFailure`).
 */
import { readUiDevServerPort } from './read-ui-dev-port.ts';

const DEFAULT_HTTP_PORT = 30000;

function parsePositivePort(raw: string | undefined, fallback: number): number {
  if (raw === undefined) {
    return fallback;
  }
  const trimmed = raw.trim();
  if (trimmed === '') {
    return fallback;
  }
  const port = Number.parseInt(trimmed, 10);
  return Number.isFinite(port) && port > 0 ? port : fallback;
}

/** Vite dev server and unified HTTP `/api/hello` URLs for the web e2e gate. */
export function resolveWebReadyUrls(
  env: Record<string, string | undefined> = process.env,
): { viteUrl: string; httpUrl: string } {
  const vitePort = parsePositivePort(env.VITE_PORT, readUiDevServerPort());
  const httpPort = parsePositivePort(env.HTTP_PORT, DEFAULT_HTTP_PORT);
  return {
    viteUrl: `http://127.0.0.1:${vitePort}/`,
    httpUrl: `http://127.0.0.1:${httpPort}/api/hello`,
  };
}

async function waitForHttp(
  url: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    timeoutMs?: number;
    intervalMs?: number;
  } = {},
): Promise<void> {
  const {
    method = 'GET',
    headers,
    timeoutMs = 120_000,
    intervalMs = 500,
  } = options;

  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, {
        method,
        headers,
        signal: AbortSignal.timeout(5_000),
      });
      if (response.ok) {
        return;
      }
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(
    `Timed out waiting for ${url}: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
  );
}

async function main(): Promise<void> {
  const token = process.env.SMM_AUTH_TOKEN ?? 'ChangeMe123';
  const { viteUrl, httpUrl } = resolveWebReadyUrls();
  console.log('[wait-for-web-e2e-ready] waiting for Vite', viteUrl);
  await waitForHttp(viteUrl);
  console.log('[wait-for-web-e2e-ready] waiting for HTTP', httpUrl);
  await waitForHttp(httpUrl, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log('[wait-for-web-e2e-ready] ready');
}

if (import.meta.main) {
  main().catch((error) => {
    console.error('[wait-for-web-e2e-ready] failed:', error);
    process.exit(1);
  });
}
