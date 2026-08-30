/**
 * Polls docker-served SMM until /api/hello responds, or exits 1 on timeout.
 * Used as the first apps/cicd task for --platform docker (no Vite UI wait).
 *
 * Base origin: `E2E_DOCKER_UI_ORIGIN` (default `http://localhost:30000/`).
 */
function resolveReadyUrl(): string {
  const origin = (process.env.E2E_DOCKER_UI_ORIGIN?.trim() || 'http://localhost:30000/').replace(
    /\/?$/,
    '/',
  );
  return new URL('api/hello', origin).toString();
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
  const readyUrl = resolveReadyUrl();
  console.log('[wait-for-docker-e2e-ready] waiting for', readyUrl);
  await waitForHttp(readyUrl, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log('[wait-for-docker-e2e-ready] ready');
}

main().catch((error) => {
  console.error('[wait-for-docker-e2e-ready] failed:', error);
  process.exit(1);
});
