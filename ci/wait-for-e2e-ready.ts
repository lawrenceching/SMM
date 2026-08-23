/**
 * Polls CLI and UI dev servers until both respond, or exits 1 on timeout.
 * Used as the first apps/cicd task before WebdriverIO runs.
 *
 * UI port is read from apps/ui/vite.config.ts (not hard-coded).
 */
import { loadEnvLocal } from './load-env-local.ts';
import { readUiDevServerPort } from './read-ui-dev-port.ts';
import { fileURLToPath } from 'node:url';
import * as path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_CLI_PORT = 30000;
const CLI_AUTH_TOKEN = 'ChangeMe123';

function resolveMainCliPort(): number {
  const raw = process.env.PORT?.trim();
  if (!raw) {
    return DEFAULT_CLI_PORT;
  }
  const port = Number.parseInt(raw, 10);
  return Number.isFinite(port) && port > 0 ? port : DEFAULT_CLI_PORT;
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
  loadEnvLocal(ROOT);

  const cliPort = resolveMainCliPort();
  const cliReadyUrl = `http://localhost:${cliPort}/api/hello`;
  console.log(`[wait-for-e2e-ready] waiting for CLI (${cliReadyUrl})`);
  await waitForHttp(cliReadyUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${CLI_AUTH_TOKEN}` },
  });

  const uiPort = readUiDevServerPort();
  const uiReadyUrl = `http://localhost:${uiPort}`;
  console.log(`[wait-for-e2e-ready] UI port from vite.config.ts: ${uiPort}`);
  console.log(`[wait-for-e2e-ready] waiting for UI (${uiReadyUrl})`);
  await waitForHttp(uiReadyUrl);
}

main().catch((error) => {
  console.error('[wait-for-e2e-ready] failed:', error);
  process.exit(1);
});
