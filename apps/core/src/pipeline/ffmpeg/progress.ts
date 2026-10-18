/**
 * Strip the CLI log line prefix `${ISO timestamp} [KIND] ` from a single
 * line. Returns the unprefixed payload, or the original line if the prefix
 * is not present.
 */
function stripLogLinePrefix(line: string): string {
  const m = /^\d{4}-\d{2}-\d{2}T[\d:.]+Z \[(?:STDOUT|STDERR|SYSTEM)\] (.*)$/.exec(line);
  return m ? m[1]!.trimEnd() : line;
}

/**
 * Parse an `HH:MM:SS[.xx]` timestamp into seconds.
 * Returns `null` on a malformed input.
 */
export function parseHmsTime(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2}):(\d{2})(?:\.(\d+))?$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  const fractionRaw = match[4] ?? "";
  const fraction = fractionRaw ? Number(`0.${fractionRaw}`) : 0;
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || !Number.isFinite(seconds)) {
    return null;
  }
  return hours * 3600 + minutes * 60 + seconds + (Number.isFinite(fraction) ? fraction : 0);
}

export function parseFfmpegProgressLine(
  line: string,
): { currentSeconds: number; speedMultiplier: number | null } | null {
  const content = stripLogLinePrefix(line);
  if (!/\btime=/.test(content)) return null;

  const timeMatch = /\btime=(\d{1,2}:\d{2}:\d{2}(?:\.\d+)?)\b/.exec(content);
  if (!timeMatch) return null;
  const currentSeconds = parseHmsTime(timeMatch[1]!);
  if (currentSeconds == null) return null;

  const speedMatch = /\bspeed=\s*(\d+(?:\.\d+)?)x\b/.exec(content);
  const speedMultiplier = speedMatch ? Number(speedMatch[1]) : null;

  return { currentSeconds, speedMultiplier };
}

export function parseDurationSeconds(line: string): number | null {
  const content = stripLogLinePrefix(line);
  const m = /\bDuration:\s*(\d{1,2}:\d{2}:\d{2}(?:\.\d+)?)\b/.exec(content);
  if (!m) return null;
  return parseHmsTime(m[1]!);
}

export function computeFfmpegProgress(opts: {
  currentSeconds: number;
  totalSeconds: number;
  speedMultiplier: number | null;
  mapStart: number;
  mapEnd: number;
}): { progress: number; etaSeconds?: number } {
  const { currentSeconds, totalSeconds, speedMultiplier, mapStart, mapEnd } = opts;

  let raw = totalSeconds > 0 ? (currentSeconds / totalSeconds) * 100 : 0;
  raw = Math.max(0, Math.min(100, raw));
  const progress = mapStart + (raw / 100) * (mapEnd - mapStart);

  let etaSeconds: number | undefined;
  if (speedMultiplier != null && speedMultiplier > 0 && totalSeconds > 0) {
    const remaining = totalSeconds - currentSeconds;
    if (remaining > 0) {
      etaSeconds = remaining / speedMultiplier;
    } else {
      etaSeconds = 0;
    }
  }

  return { progress, ...(etaSeconds !== undefined ? { etaSeconds } : {}) };
}
