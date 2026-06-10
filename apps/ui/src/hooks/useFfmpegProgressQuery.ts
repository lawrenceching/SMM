import { useMemo } from 'react'
import { useCommandLogQuery } from './useCommandLogQuery'

/**
 * Latest ffmpeg transcode progress parsed from the CLI command log.
 * Returns `null` when the log has no parseable progress line yet.
 */
export interface FfmpegProgress {
  /** 0-100 percent of the encode. Null until both Duration and time= are seen. */
  percent: number | null
  /** Encoded seconds (from latest `time=HH:MM:SS.xx`). */
  currentSeconds: number
  /** Total seconds (from latest `Duration: HH:MM:SS.xx`). Null if not yet seen. */
  totalSeconds: number | null
  /** ETA seconds. Null if totalSeconds or speed unavailable. */
  etaSeconds: number | null
  /** Real-time speed multiplier from `speed=Nx` (e.g. 8.41). Null if absent. */
  speedMultiplier: number | null
  /** Local time (ms) when this progress was extracted from the log. */
  updatedAt: number
}

/**
 * Parse an `HH:MM:SS[.xx]` timestamp into seconds.
 * Returns `null` on a malformed input.
 *
 * Examples:
 *   parseHmsTime('00:02:59.71') === 179.71
 *   parseHmsTime('01:00:00')    === 3600
 *   parseHmsTime('00:00:00.5')  === 0.5
 */
export function parseHmsTime(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2}):(\d{2})(?:\.(\d+))?$/.exec(value.trim())
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  const seconds = Number(match[3])
  const fractionRaw = match[4] ?? ''
  const fraction = fractionRaw ? Number(`0.${fractionRaw}`) : 0
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || !Number.isFinite(seconds)) {
    return null
  }
  return hours * 3600 + minutes * 60 + seconds + (Number.isFinite(fraction) ? fraction : 0)
}

/**
 * Match an `HH:MM:SS[.xx]` token inside a free-form line. Returns the raw
 * substring (without leading/trailing whitespace) or null when no such token
 * is present.
 */
function findHmsToken(line: string): string | null {
  const match = /\b(\d{1,2}:\d{2}:\d{2}(?:\.\d+)?)\b/.exec(line)
  return match ? match[1] : null
}

/**
 * Strip the CLI log line prefix `${ISO timestamp} [KIND] ` from a single
 * line. Returns the unprefixed payload, or the original line if the prefix
 * is not present (so callers can still try to parse unknown lines).
 */
export function stripLogLinePrefix(line: string): string {
  const m = /^\d{4}-\d{2}-\d{2}T[\d:.]+Z \[(?:STDOUT|STDERR|SYSTEM)\] (.*)$/.exec(line)
  return m ? m[1]!.trimEnd() : line
}

/**
 * Parse a single ffmpeg stderr progress line. Returns null if the line
 * doesn't look like a progress line (no `time=` token).
 *
 * Recognised lines typically look like:
 *   frame=   77 fps=0.0 q=31.9 size=       0KiB time=00:00:02.50 bitrate=   0.1kbits/s speed=4.77x elapsed=0:00:00.52
 *   frame= 5390 fps=253 q=39.7 Lsize=    4998KiB time=00:02:59.60 bitrate= 227.9kbits/s speed=8.41x elapsed=0:00:21.34
 *
 * The token order and padding vary between ffmpeg versions, so the regex
 * is intentionally tolerant of any spacing and any field order.
 */
export function parseFfmpegProgressLine(
  line: string,
): { currentSeconds: number; speedMultiplier: number | null } | null {
  const content = stripLogLinePrefix(line)
  // fast skip: only lines mentioning `time=` are progress lines
  if (!/\btime=/.test(content)) return null

  const timeMatch = /\btime=(\d{1,2}:\d{2}:\d{2}(?:\.\d+)?)\b/.exec(content)
  if (!timeMatch) return null
  const currentSeconds = parseHmsTime(timeMatch[1]!)
  if (currentSeconds == null) return null

  // speed=8.41x — multiplier is optional (ffmpeg omits it on the very first
  // progress line). Allow for whitespace between `=` and the value.
  const speedMatch = /\bspeed=\s*(\d+(?:\.\d+)?)x\b/.exec(content)
  const speedMultiplier = speedMatch ? Number(speedMatch[1]) : null

  return { currentSeconds, speedMultiplier }
}

/**
 * Walk the raw command-log text and return the latest ffmpeg progress
 * snapshot.
 *
 * Strategy:
 *   1. Find the most recent `Duration: HH:MM:SS.xx` line (total).
 *   2. Find the most recent `frame=… time=…` line (current encoded).
 *   3. Compute percent and ETA from those two numbers.
 *
 * If only the Duration is present (early in the run), returns
 * `{ percent: null, currentSeconds: 0, totalSeconds, etaSeconds: null, … }`.
 *
 * If no Duration is present yet (image inputs, or very early in the run),
 * returns `null`.
 */
export function extractLatestFfmpegProgress(logText: string): FfmpegProgress | null {
  if (!logText) return null
  const lines = logText.split(/\r?\n/)

  let totalSeconds: number | null = null
  let totalLineIndex = -1
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i]
    if (!line) continue
    const content = stripLogLinePrefix(line)
    const m = /\bDuration:\s*(\d{1,2}:\d{2}:\d{2}(?:\.\d+)?)\b/.exec(content)
    if (m) {
      const parsed = parseHmsTime(m[1]!)
      if (parsed != null && parsed > 0) {
        totalSeconds = parsed
        totalLineIndex = i
        break
      }
    }
  }

  if (totalSeconds == null) return null

  // Find the latest progress line at or after the duration line.
  // (Pre-Duration lines are encoder probing, not the real encode — but
  // since `time=` resets to 00:00:00 at the start of the encode, scanning
  // from the end is correct regardless.)
  let currentSeconds = 0
  let speedMultiplier: number | null = null
  let foundProgress = false
  for (let i = lines.length - 1; i >= totalLineIndex; i--) {
    const line = lines[i]
    if (!line) continue
    const parsed = parseFfmpegProgressLine(line)
    if (parsed) {
      currentSeconds = parsed.currentSeconds
      speedMultiplier = parsed.speedMultiplier
      foundProgress = true
      break
    }
  }

  if (!foundProgress) {
    // No progress line yet — surface duration so the UI can decide.
    return {
      percent: null,
      currentSeconds: 0,
      totalSeconds,
      etaSeconds: null,
      speedMultiplier: null,
      updatedAt: Date.now(),
    }
  }

  const percent = Math.max(0, Math.min(100, (currentSeconds / totalSeconds) * 100))
  let etaSeconds: number | null = null
  if (speedMultiplier != null && speedMultiplier > 0) {
    const remaining = totalSeconds - currentSeconds
    if (remaining > 0) {
      etaSeconds = remaining / speedMultiplier
    } else {
      etaSeconds = 0
    }
  }

  return {
    percent,
    currentSeconds,
    totalSeconds,
    etaSeconds,
    speedMultiplier,
    updatedAt: Date.now(),
  }
}

export interface UseFfmpegProgressQueryArgs {
  executionId: string
  isRunning: boolean
  /** Poll interval in ms. Defaults to 200. */
  refetchIntervalMs?: number
}

export interface UseFfmpegProgressQueryResult {
  progress: FfmpegProgress | null
  isPending: boolean
  isFetching: boolean
  error: Error | null
}

/**
 * Specialized consumer of {@link useCommandLogQuery} that parses ffmpeg
 * progress lines out of the command log. Returns the latest progress
 * snapshot, or `null` when no Duration / progress line is present yet.
 *
 * Mirrors `useYtdlpDownloadProgressQuery` so the popover can render
 * real-time percent + ETA for `ffmpeg-convert` jobs without an extra HTTP
 * request — both hooks share the `['command-log', executionId]` query.
 *
 * See `docs/design/ffmpeg-progress-display.md` for the full design.
 */
export function useFfmpegProgressQuery({
  executionId,
  isRunning,
  refetchIntervalMs = 200,
}: UseFfmpegProgressQueryArgs): UseFfmpegProgressQueryResult {
  const { data, isPending, isFetching, error } = useCommandLogQuery({
    executionId,
    enabled: isRunning,
    isRunning,
    refetchIntervalMs,
  })

  const progress = useMemo<FfmpegProgress | null>(
    () => extractLatestFfmpegProgress(data?.text ?? ''),
    [data?.text],
  )

  return { progress, isPending, isFetching, error }
}

// Re-export the helper used by BackgroundJobItem.tsx to find HMS tokens
// inside free-form log segments (e.g. for the Log dialog "Duration" callout).
export { findHmsToken }