/**
 * Polls CLI and UI dev servers until both respond, or exits 1 on timeout.
 * Used as the first apps/cicd task before WebdriverIO runs.
 */
const CLI_READY_URL = 'http://localhost:30000/api/hello';
const UI_READY_URL = 'http://localhost:5173';
const CLI_AUTH_TOKEN = 'ChangeMe123';

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
  console.log('[wait-for-e2e-ready] waiting for CLI (http://localhost:30000)');
  await waitForHttp(CLI_READY_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${CLI_AUTH_TOKEN}` },
  });

  console.log('[wait-for-e2e-ready] waiting for UI (http://localhost:5173)');
  await waitForHttp(UI_READY_URL);
}

main().catch((error) => {
  console.error('[wait-for-e2e-ready] failed:', error);
  process.exit(1);
});
