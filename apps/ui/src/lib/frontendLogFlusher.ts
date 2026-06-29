import type { FrontendLogBatch } from "@/types/frontendLog";
import { FrontendLogBuffer } from "./frontendLogBuffer";

const FLUSH_INTERVAL_MS = 2_000;
const ENDPOINT = "/api/log";
const BLOB_TYPE = "application/json";

let bufferRef: FrontendLogBuffer | null = null;
let intervalId: ReturnType<typeof setInterval> | null = null;
let pageHideHandler: (() => void) | null = null;

function getAppVersion(): string {
  const v = (import.meta as unknown as { env?: { VITE_APP_VERSION?: string } }).env?.VITE_APP_VERSION;
  return v ?? "unknown";
}

async function flush(): Promise<void> {
  if (!bufferRef) return;
  const entries = bufferRef.drain();
  if (entries.length === 0) return;

  const batch: FrontendLogBatch = { entries, appVersion: getAppVersion() };
  let body: Blob;
  try {
    body = new Blob([JSON.stringify(batch)], { type: BLOB_TYPE });
  } catch {
    return;
  }

  try {
    const beacon = typeof navigator !== "undefined" ? navigator.sendBeacon?.bind(navigator) : undefined;
    const ok = beacon ? beacon(ENDPOINT, body) : false;
    if (ok) return;
    if (typeof fetch !== "undefined") {
      await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": BLOB_TYPE },
        body,
        keepalive: true,
      });
    }
  } catch {
    // Swallow — best-effort logging.
  }
}

/**
 * Start the periodic flush loop and the pagehide handler.
 * Idempotent: re-calling is a no-op until _resetFlusherForTests() runs.
 */
export function startFrontendLogFlusher(buffer: FrontendLogBuffer): void {
  if (intervalId !== null) return;
  bufferRef = buffer;
  intervalId = setInterval(() => { void flush(); }, FLUSH_INTERVAL_MS);
  pageHideHandler = () => { void flush(); };
  window.addEventListener("pagehide", pageHideHandler);
}

/** Test helper to undo startFrontendLogFlusher between tests. */
export function _resetFlusherForTests(): void {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
  if (pageHideHandler) {
    window.removeEventListener("pagehide", pageHideHandler);
    pageHideHandler = null;
  }
  bufferRef = null;
}
