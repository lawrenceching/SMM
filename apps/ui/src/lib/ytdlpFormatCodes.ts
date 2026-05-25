export type YtdlpFormatCodeCategory = "audio-only" | "video-only" | "combined"

export interface YtdlpFormatCodeEntry {
  id: string
  ext: string
  resolution: string
  fps: number | null
  /** Display label (e.g. "18 - 640x360 mp4"). */
  label: string
  category: YtdlpFormatCodeCategory
}

/**
 * Parses yt-dlp `--list-formats` stdout into format code entries grouped by category.
 * Expects the table output starting from the `ID` header line.
 */
export function parseYtdlpFormatCodes(text: string): YtdlpFormatCodeEntry[] {
  const lines = text.split("\n")
  const entries: YtdlpFormatCodeEntry[] = []

  // Find the header line: "ID      EXT   RESOLUTION ..."
  let startIndex = -1
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*ID\s+EXT\s+RESOLUTION/.test(lines[i])) {
      startIndex = i + 1
      break
    }
  }
  if (startIndex === -1) return entries

  // Find the separator line (dashes) and skip it
  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim()
    // Skip separator lines (all dashes/spaces)
    if (/^[-─\s]+$/.test(line)) continue
    if (!line) continue

    const entry = parseFormatLine(line)
    if (entry) entries.push(entry)
  }

  return entries
}

function parseFormatLine(line: string): YtdlpFormatCodeEntry | null {
  // Format: ID EXT RESOLUTION FPS CH | FILESIZE TBR PROTO | VCODEC VBR ACODEC ABR ASR MORE INFO
  const parts = line.split(/\s+/)
  if (parts.length < 3) return null

  const id = parts[0]
  // Skip storyboard entries (sb0, sb1, etc.)
  if (id.startsWith("sb")) return null

  const ext = parts[1] || ""
  const resolution = parts[2] || ""
  let fps: number | null = null
  if (parts.length > 3 && /^\d+$/.test(parts[3])) {
    fps = parseInt(parts[3], 10)
  }

  // Determine category from the rest of the line
  const rest = line.substring(parts.slice(0, 4).join(" ").length).trim()
  const isAudioOnly = rest.includes("audio only")
  const isVideoOnly = rest.includes("video only")

  let category: YtdlpFormatCodeCategory
  if (isAudioOnly) {
    category = "audio-only"
  } else if (isVideoOnly) {
    category = "video-only"
  } else {
    category = "combined"
  }

  const fpsStr = fps ? ` ${fps}fps` : ""
  const label = `${id} - ${ext} ${resolution}${fpsStr}`

  return { id, ext, resolution, fps, label, category }
}

export function groupFormatsByCategory(entries: YtdlpFormatCodeEntry[]): {
  audioOnly: YtdlpFormatCodeEntry[]
  videoOnly: YtdlpFormatCodeEntry[]
  combined: YtdlpFormatCodeEntry[]
} {
  return {
    audioOnly: entries.filter((e) => e.category === "audio-only"),
    videoOnly: entries.filter((e) => e.category === "video-only"),
    combined: entries.filter((e) => e.category === "combined"),
  }
}
