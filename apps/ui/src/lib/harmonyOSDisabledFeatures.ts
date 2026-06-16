/**
 * HarmonyOS-disabled UI features. Keep in sync with
 * `.agents/docs/design/harmonyos-integration.md` §6 Disabled Features.
 */
export const HARMONYOS_DISABLED_FEATURE_IDS = [
  /** Transcribe / translate / synthesize / process pipeline (字幕) */
  "subtitle",
  /** yt-dlp download video dialog and music panel download */
  "downloadVideo",
  /** FFmpeg format converter dialog (视频转码) */
  "formatConverter",
  /** Video compression dialog (视频压缩) */
  "videoCompression",
] as const

export type HarmonyOSDisabledFeatureId = (typeof HARMONYOS_DISABLED_FEATURE_IDS)[number]
