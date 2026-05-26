import type { Format } from "@/api/ytdlp/types"

export type YtdlpFormatCodeCategory = "audio-only" | "video-only" | "combined"

export interface YtdlpFormatCodeEntry {
  id: string
  ext: string
  resolution: string
  fps: number | null
  category: YtdlpFormatCodeCategory
  /** Primary line (e.g. "m4a" for audio, "360P (640x360) mp4" for video). */
  title: string
  /** Secondary line (e.g. "~66kbps ~279KB mp4a.40.2"). */
  subtitle: string
}

/**
 * Converts `yt-dlp -J` Format objects into format code entries grouped by category.
 */
export function buildFormatCodes(formats: Format[]): YtdlpFormatCodeEntry[] {
  return formats
    .filter((f) => !f.format_id.startsWith("sb"))
    .map((f) => {
      const category = categorizeFormat(f)
      return {
        id: f.format_id,
        ext: f.ext,
        resolution: f.resolution ?? "",
        fps: f.fps ?? null,
        category,
        title: buildTitle(f, category),
        subtitle: buildSubtitle(f, category),
      }
    })
}

function buildTitle(f: Format, category: YtdlpFormatCodeCategory): string {
  if (category === "audio-only") {
    return f.ext
  }
  // Video-only or combined: e.g. "360P (640x360) mp4"
  const quality = extractQualityLabel(f)
  const res = f.resolution ? ` (${f.resolution})` : ""
  return `${quality}${res} ${f.ext}`
}

function extractQualityLabel(f: Format): string {
  if (f.height && f.height >= 2160) return "4K"
  if (f.height && f.height >= 1440) return "1440P"
  if (f.height && f.height >= 1080) return "1080P"
  if (f.height && f.height >= 720) return "720P"
  if (f.height && f.height >= 480) return "480P"
  if (f.height && f.height >= 360) return "360P"
  if (f.height) return `${f.height}P`
  if (f.resolution) return f.resolution
  return f.format_id
}

function buildSubtitle(f: Format, category: YtdlpFormatCodeCategory): string {
  const parts: string[] = []

  if (f.tbr) {
    parts.push(`~${formatBitrate(f.tbr)}`)
  }
  if (f.filesize_approx) {
    parts.push(`~${formatFileSize(f.filesize_approx)}`)
  }

  if (category === "audio-only") {
    if (f.acodec) parts.push(f.acodec)
  } else if (category === "video-only") {
    if (f.vcodec) parts.push(f.vcodec)
  } else {
    const codecs = [f.acodec, f.vcodec].filter(Boolean)
    if (codecs.length > 0) parts.push(codecs.join("+"))
  }

  return parts.join(" ")
}

function formatBitrate(tbr: number): string {
  return `${Math.round(tbr)}kbps`
}

function formatFileSize(bytes: number): string {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)}MB`
  if (bytes >= 1_000) return `${Math.round(bytes / 1_000)}KB`
  return `${bytes}B`
}

function categorizeFormat(f: Format): YtdlpFormatCodeCategory {
  const hasAudio = f.acodec !== "none" && f.acodec !== null
  const hasVideo = f.vcodec !== "none" && f.vcodec !== null
  if (hasAudio && !hasVideo) return "audio-only"
  if (hasVideo && !hasAudio) return "video-only"
  return "combined"
}

/** Extracts unique sorted heights from a Format array. */
export function extractAvailableHeights(formats: Format[]): number[] {
  const heightSet = new Set<number>()
  for (const f of formats) {
    if (f.height) heightSet.add(f.height)
  }
  return Array.from(heightSet).sort((a, b) => a - b)
}

/** Returns true if 1080p video is available in the format list. */
export function is1080pAvailableFromFormats(formats: Format[]): boolean {
  return formats.some((f) => f.height === 1080)
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
