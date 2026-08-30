export interface HostPerformanceEntry {
  host: string;
  score: number;
}

export type HostPerformanceKind = "tmdb" | "tvdb" | "tmdb-asset" | "tvdb-asset";

export function normalizeHostUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

export function mergeHostUrls(...lists: string[][]): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const list of lists) {
    for (const url of list) {
      const normalized = normalizeHostUrl(url);
      if (!normalized || seen.has(normalized)) continue;
      seen.add(normalized);
      merged.push(normalized);
    }
  }
  return merged;
}

export function isCustomHost(host: string | undefined, defaultUpstream: string): boolean {
  const trimmed = host?.trim() ?? "";
  if (!trimmed) return false;
  try {
    // eslint-disable-next-line no-new
    new URL(trimmed);
  } catch {
    return false;
  }
  return normalizeHostUrl(trimmed) !== normalizeHostUrl(defaultUpstream);
}

export interface SelectCandidateHostsOptions {
  customHost?: string;
  defaultUpstream: string;
  performanceList: readonly HostPerformanceEntry[];
  fallbackHosts: string[];
}

export interface CandidateHostSelection {
  hosts: string[];
  allowFailover: boolean;
}

/** Pick TMDB/TVDB hosts: custom (no failover) → performance order → static+remote fallback. */
export function selectCandidateHosts(options: SelectCandidateHostsOptions): CandidateHostSelection {
  if (isCustomHost(options.customHost, options.defaultUpstream)) {
    return { hosts: [normalizeHostUrl(options.customHost!)], allowFailover: false };
  }
  if (options.performanceList.length === 0) {
    return { hosts: [...options.fallbackHosts], allowFailover: true };
  }
  return {
    hosts: options.performanceList.map((entry) => normalizeHostUrl(entry.host)),
    allowFailover: true,
  };
}

export class HostPerformanceStore {
  private readonly lists: Record<HostPerformanceKind, HostPerformanceEntry[]> = {
    tmdb: [],
    tvdb: [],
    "tmdb-asset": [],
    "tvdb-asset": [],
  };

  get(kind: HostPerformanceKind): readonly HostPerformanceEntry[] {
    return this.lists[kind];
  }

  set(kind: HostPerformanceKind, entries: HostPerformanceEntry[]): void {
    this.lists[kind] = entries.map((entry) => ({
      host: normalizeHostUrl(entry.host),
      score: entry.score,
    }));
  }

  /**
   * Move a reachable host to the front with score 0 so the next request prefers it.
   * No-op while the list is empty (speed test running, skipped, or failed).
   */
  promoteToTop(kind: HostPerformanceKind, host: string): void {
    const list = this.lists[kind];
    if (list.length === 0) return;

    const normalized = normalizeHostUrl(host);
    const index = list.findIndex((entry) => {
      if (normalizeHostUrl(entry.host) === normalized) return true;
      try {
        return new URL(entry.host).host === new URL(normalized).host;
      } catch {
        return false;
      }
    });
    const promoted: HostPerformanceEntry = { host: index === -1 ? normalized : list[index]!.host, score: 0 };
    const rest = index === -1 ? list : list.filter((_, i) => i !== index);
    this.lists[kind] = [promoted, ...rest];
  }
}
