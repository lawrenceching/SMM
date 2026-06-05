import { useMemo } from 'react'
import { useCommandLogQuery } from './useCommandLogQuery'

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
  let percent: number | null = null
  if (typeof parsed.percent === 'string') {
    // yt-dlp's `_percent_json` field includes a trailing `%` (e.g. `"42.5%"`).
    // Strip it before numeric parsing.
    const cleaned = parsed.percent.replace(/%$/g, '').trim()
    percent = parseProgressNumericValue(cleaned)
  } else {
    percent = parseProgressNumericValue(parsed.percent)
  }
  if (percent == null && downloaded != null && total != null && total > 0) {
    percent = (downloaded / total) * 100
  }
  if (percent == null) percent = 0

  // Default speed/eta to 0 when yt-dlp reports `"NA"`, so the UI always
  // shows speed/eta elements (with "0 B/s" / "0s") instead of hiding
  // them and making the user wonder if the app is broken.
  const speed = parseProgressNumericValue(parsed.speed) ?? 0
  const eta = parseProgressNumericValue(parsed.eta) ?? 0

  const result: YtdlpDownloadProgress = {
    percent,
    speedBps: speed,
    etaSeconds: eta,
    downloadedBytes: downloaded,
    totalBytes: total,
    status: statusRaw,
    updatedAt: Date.now(),
  }

  return result
}

/**
 * Walk the raw command-log text from end to beginning, return the
 * progress parsed from the LAST line that is valid yt-dlp progress JSON.
 *
 * Each line in the log is prefixed with `${ISO timestamp} [KIND] `, so we
 * strip everything up to and including the closing `] ` before trying to
 * JSON.parse. Earlier (older) lines are stale — we only care about the
 * most recent state.
 */
export function extractLatestProgress(logText: string): YtdlpDownloadProgress | null {
  if (!logText) return null
  // Strip the per-line prefix `${ISO timestamp} [KIND] ` and keep only
  // the content that follows. The regex is anchored so unrelated text
  // (or lines that don't follow the prefix format) is ignored.
  const lineRe = /^\d{4}-\d{2}-\d{2}T[\d:.]+Z \[(?:STDOUT|STDERR|SYSTEM)\] (.*)$/
  const lines = logText.split(/\r?\n/)
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i]
    if (!line) continue
    const m = line.match(lineRe)
    if (!m) continue
    const content = m[1]!.trim()
    // Fast skip: progress lines are JSON objects starting with `{`.
    if (!content.startsWith('{')) continue
    const parsed = parseYtdlpProgressLine(content)
    if (parsed) return parsed
  }
  return null
}

export interface UseYtdlpDownloadProgressQueryArgs {
  executionId: string
  isRunning: boolean
  /** Poll interval in ms. Defaults to 200. */
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
  refetchIntervalMs = 200,
}: UseYtdlpDownloadProgressQueryArgs): UseYtdlpDownloadProgressQueryResult {
  // For popover progress, "enabled" follows "isRunning": no point in
  // keeping the polling query active after the job is done.
  const { data, isPending, isFetching, error } = useCommandLogQuery({
    executionId,
    enabled: isRunning,
    isRunning,
    refetchIntervalMs,
  })

  const progress = useMemo<YtdlpDownloadProgress | null>(
    () => extractLatestProgress(data?.text ?? ''),
    [data?.text],
  )

  return { progress, isPending, isFetching, error }
}
