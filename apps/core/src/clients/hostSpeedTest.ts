import type { NetworkPort } from "../ports/NetworkPort";
import { normalizeHostUrl, type HostPerformanceEntry } from "./hostPerformance";

export const HOST_SPEED_TEST_TIMEOUT_MS = 5_000;

export interface SpeedTestHostsOptions {
  now?: () => number;
  timeoutMs?: number;
}

/**
 * Dummy-GET each host and score it by duration in seconds (lower is better).
 * TCP-or-below failures are omitted; HTTP 4xx/5xx still count as reachable.
 */
export async function speedTestHosts(
  network: NetworkPort,
  hosts: string[],
  options: SpeedTestHostsOptions = {},
): Promise<HostPerformanceEntry[]> {
  const now = options.now ?? (() => performance.now());
  const timeoutMs = options.timeoutMs ?? HOST_SPEED_TEST_TIMEOUT_MS;
  const entries: HostPerformanceEntry[] = [];

  for (const host of hosts) {
    const normalized = normalizeHostUrl(host);
    if (!normalized) continue;
    const start = now();
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        await network.fetch(normalized, { method: "GET", signal: controller.signal });
      } finally {
        clearTimeout(timer);
      }
      entries.push({ host: normalized, score: (now() - start) / 1000 });
    } catch {
      // Unreachable at TCP or below — skip so an all-fail run leaves the list empty.
    }
  }

  return entries.sort((a, b) => a.score - b.score);
}
