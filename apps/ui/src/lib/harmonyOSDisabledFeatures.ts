/**
 * HarmonyOS-disabled UI features. Keep in sync with
 * `.agents/docs/design/harmonyos-integration.md` §6 Disabled Features.
 *
 * The AI Summary (MusicPanel right-click → Summarize) flow is gated via the
 * master `isAiFeatureEnabled` flag, which defaults to `false` on HarmonyOS
 * (see `apps/ui/src/hooks/useFeatures.ts` `readAiFeatureEnabled`). MCP/backend
 * plan prompts (`AiBasedRecognizePrompt`, `AiBasedRenameFilePrompt`) are not
 * gated by that flag — pending `creator: "ai"` plans must always be confirmable.
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
  /** Music folder type in OpenFolderDialog (导入音乐文件夹) */
  "musicFolderImport",
] as const

export type HarmonyOSDisabledFeatureId = (typeof HARMONYOS_DISABLED_FEATURE_IDS)[number]
