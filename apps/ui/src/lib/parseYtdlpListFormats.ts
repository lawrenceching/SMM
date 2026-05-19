export interface YtdlpListFormatsResult {
  availableHeights: number[]
  hasAudioOnly: boolean
}

/**
 * Parses the stdout of `yt-dlp --list-formats` / `yt-dlp -F`.
 *
 * Strategy (robust across yt-dlp versions, locales, and platforms):
 * 1. Locate the line containing "Available formats for" — the section header.
 * 2. Skip the table header row (contains "RESOLUTION") and the following separator line.
 * 3. Collect subsequent data lines until a blank line or a `[…]` log prefix line.
 * 4. For each data line, strip `│` separators and look for a WxH resolution pattern.
 *    Lines that only have "audio only" (no WxH) contribute to hasAudioOnly.
 * 5. Deduplicate heights and return sorted ascending.
 */
export function parseYtdlpListFormatsStdout(stdout: string): YtdlpListFormatsResult {
  if (!stdout.trim()) {
    return { availableHeights: [], hasAudioOnly: false }
  }

  const lines = stdout.split(/\r?\n/)

  // Find the "Available formats for …" header line
  const headerIdx = lines.findIndex((line) =>
    line.toLowerCase().includes("available formats for"),
  )
  if (headerIdx === -1) {
    return { availableHeights: [], hasAudioOnly: false }
  }

  // Skip header row (RESOLUTION column) and separator line(s)
  let dataStart = headerIdx + 1
  while (dataStart < lines.length) {
    const line = lines[dataStart]
    if (!line) { dataStart++; continue }
    // Table header row: contains "RESOLUTION" or "EXT"
    if (/\bRESOLUTION\b/i.test(line) || /\bEXT\b/i.test(line)) { dataStart++; continue }
    // Separator line: composed purely of dashes, box-drawing chars, spaces, and │
    if (/^[\s─━─\-─\u2500\u2501\u2502\u2503\u2506\u2507\u2550\u2508│|─\-]+$/.test(line)) { dataStart++; continue }
    break
  }

  const heightSet = new Set<number>()
  let hasAudioOnly = false

  for (let i = dataStart; i < lines.length; i++) {
    const line = lines[i]
    if (line === undefined) continue
    // Stop at blank line or yt-dlp log prefix line like "[BiliBili] ..."
    if (line.trim() === "") break
    if (/^\[/.test(line.trim())) break

    // Check for audio-only
    if (/audio only/i.test(line)) {
      hasAudioOnly = true
      continue
    }

    // Extract WxH resolution (e.g. 1920x1080, 640x360)
    const match = /\b(\d{2,5})x(\d{2,5})\b/.exec(line)
    if (match) {
      const height = parseInt(match[2], 10)
      if (height > 0) {
        heightSet.add(height)
      }
    }
  }

  const availableHeights = Array.from(heightSet).sort((a, b) => a - b)
  return { availableHeights, hasAudioOnly }
}

/** Returns true if 1080p video is available in the format list. */
export function is1080pAvailable(result: YtdlpListFormatsResult): boolean {
  return result.availableHeights.includes(1080)
}
