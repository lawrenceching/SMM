import { useMemo } from 'react'
import { useCommandLogQuery, type CommandLogQueryData } from './useCommandLogQuery'
import type { CommandLogSegment } from '@/api/commandLog'

/**
 * Latest yt-dlp download progress parsed from the CLI command log.
 * Returns `null` when the log has no parseable progress line yet.
 */
export interface YtdlpDownloadProgress {
  /** 0-100 percent of the current video. */
  percent: number
  /** Bytes per second. */
  speedBps: number
  /** Estimated seconds remaining; null if unknown. */
  etaSeconds: number | null
  /** Bytes downloaded; null if unknown. */
  downloadedBytes: number | null
  /** Total bytes; null if unknown. */
  totalBytes: number | null
  status: 'downloading' | 'finished'
  /** Local time (ms) when this progress was extracted from the log. */
  updatedAt: number
}

/**
 * yt-dlp emits the literal text `NA` (no quotes) for unavailable values
 * of `eta`, `downloaded_bytes`, and `total_bytes` in the progress template.
 * This produces invalid JSON. We replace the value `NA` with `null` so
 * `JSON.parse` succeeds. The pattern is restricted to value position
 * (`: *NA` requires a preceding colon) so that the quoted string `"NA"`
 * emitted for `percent` and `speed` is not touched.
 */
function sanitizeYtdlpProgressLine(line: string): string {
  return line.replace(/: *NA\b/g, ':null')
}

function parseProgressNumericValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string') {
    if (value === 'NA' || value.trim() === '') return null
    const n = Number(value)
    return Number.isFinite(n) ? n : null
  }
  return null
}

/**
 * Parse a single line that looks like yt-dlp progress JSON. Returns null
 * if the line is not progress JSON.
 *
 * Mirrors CLI-side `parseYtdlpProgressLine` so the UI and server agree
 * on what counts as a progress line.
 */
export function parseYtdlpProgressLine(line: string): YtdlpDownloadProgress | null {
  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(sanitizeYtdlpProgressLine(line)) as Record<string, unknown>
  } catch {
    return null
  }
  const statusRaw = parsed.status
  if (statusRaw !== 'downloading' && statusRaw !== 'finished') {
    return null
  }
  const downloaded = parseProgressNumericValue(parsed.downloaded)
  const total = parseProgressNumericValue(parsed.total)

  // `percent` is often `"NA"` (a string) for resumed or freshly started
  // downloads, so fall back to downloaded/total when it is not a number.
  let percent = parseProgressNumericValue(parsed.percent)
  if (percent == null && downloaded != null && total != null && total > 0) {
    percent = (downloaded / total) * 100
  }
  if (percent == null) percent = 0

  const speed = parseProgressNumericValue(parsed.speed) ?? 0
  const eta = parseProgressNumericValue(parsed.eta)

  return {
    percent,
    speedBps: speed,
    etaSeconds: eta,
    downloadedBytes: downloaded,
    totalBytes: total,
    status: statusRaw,
    updatedAt: Date.now(),
  }
}

/**
 * Walk stdout segments in order, find the LAST line that parses as yt-dlp
 * progress JSON. Earlier lines are stale (we only care about the most
 * recent state). ANSI escape codes are stripped from the body before
 * splitting into lines.
 */
export function extractLatestProgress(segments: CommandLogSegment[]): YtdlpDownloadProgress | null {
  // Walk in reverse so the first parse hit is the latest.
  for (let i = segments.length - 1; i >= 0; i--) {
    const seg = segments[i]
    if (!seg || seg.kind !== 'stdout') continue
    // Strip ANSI escape codes (CSI sequences) — ConPTY emits them in stdout.
    const clean = seg.body.replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, '')
    const lines = clean.split(/\r?\n/)
    for (let j = lines.length - 1; j >= 0; j--) {
      const line = lines[j]?.trim() ?? ''
      if (!line.startsWith('{')) continue
      const parsed = parseYtdlpProgressLine(line)
      if (parsed) return parsed
    }
  }
  return null
}

export interface UseYtdlpDownloadProgressQueryArgs {
  executionId: string
  isRunning: boolean
  /** Poll interval in ms. Defaults to 2000 (matches CLI 2s poll cycle). */
  refetchIntervalMs?: number
}

export interface UseYtdlpDownloadProgressQueryResult {
  progress: YtdlpDownloadProgress | null
  isPending: boolean
  isFetching: boolean
  error: Error | null
}

/**
 * Specialized consumer of {@link useCommandLogQuery} that parses yt-dlp
 * progress JSON lines out of the command log. Returns the latest progress
 * snapshot, or `null` when no progress line is present yet.
 *
 * ## Why this exists
 *
 * BackgroundJobsPopover needs real-time per-video percent / speed / ETA.
 * The previous design routed these through `onProgress` NDJSON callbacks
 * and patched them into the job store — but IDB poll would overwrite
 * the in-memory patch with stale persisted state, causing the popover
 * to flicker back to 0. Routing progress through log polling makes
 * `main.log` the single source of truth and avoids the round-trip
 * through IDB.
 */
export function useYtdlpDownloadProgressQuery({
  executionId,
  isRunning,
  refetchIntervalMs = 2000,
}: UseYtdlpDownloadProgressQueryArgs): UseYtdlpDownloadProgressQueryResult {
  // For popover progress, "enabled" follows "isRunning": no point in
  // keeping the polling query active after the job is done.
  const { data, isPending, isFetching, error } = useCommandLogQuery({
    executionId,
    enabled: isRunning,
    isRunning,
    format: 'segments',
    refetchIntervalMs,
  })

  const progress = useMemo<YtdlpDownloadProgress | null>(() => {
    if (!data || data.kind !== 'segments') return null
    return extractLatestProgress(data.segments)
  }, [data])

  return { progress, isPending, isFetching, error }
}
