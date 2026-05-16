export const YTDLP_DOWNLOAD_ALLOWED_ARGS = [
  "--write-thumbnail",
  "--embed-thumbnail",
  "--embed-metadata",
] as const;

export const VIDEOCAPTIONER_ASR_ENGINES = ["bijian", "jianying", "whisper-cpp"] as const;
export type VideoCaptionerAsrEngine = (typeof VIDEOCAPTIONER_ASR_ENGINES)[number];

export const VIDEOCAPTIONER_TRANSCRIBE_FORMATS = ["srt", "ass", "txt", "json"] as const;
export type VideoCaptionerTranscribeFormat = (typeof VIDEOCAPTIONER_TRANSCRIBE_FORMATS)[number];

export const VIDEOCAPTIONER_TRANSLATORS = ["bing", "google", "llm"] as const;
export type VideoCaptionerTranslator = (typeof VIDEOCAPTIONER_TRANSLATORS)[number];

export const VIDEOCAPTIONER_SUBTITLE_LAYOUTS = [
  "target-above",
  "source-above",
  "target-only",
  "source-only",
] as const;
export type VideoCaptionerSubtitleLayout = (typeof VIDEOCAPTIONER_SUBTITLE_LAYOUTS)[number];

export const VIDEOCAPTIONER_SYNTHESIZE_SUBTITLE_MODES = ["soft", "hard"] as const;
export type VideoCaptionerSynthesizeSubtitleMode =
  (typeof VIDEOCAPTIONER_SYNTHESIZE_SUBTITLE_MODES)[number];

export const VIDEOCAPTIONER_SYNTHESIZE_QUALITY = ["ultra", "high", "medium", "low"] as const;
export type VideoCaptionerSynthesizeQuality = (typeof VIDEOCAPTIONER_SYNTHESIZE_QUALITY)[number];

export const VIDEOCAPTIONER_SYNTHESIZE_RENDER_MODES = ["ass", "rounded"] as const;
export type VideoCaptionerSynthesizeRenderMode =
  (typeof VIDEOCAPTIONER_SYNTHESIZE_RENDER_MODES)[number];

/** Placeholder for videocaptioner CLI when no LLM key is needed. */
export const VIDEOCAPTIONER_CLI_DUMMY_API_KEY = "dummykey";

export type FfmpegConvertFormat = "mp4h264" | "mp4h265" | "webm" | "mkv";
export type FfmpegConvertPreset = "quality" | "balanced" | "speed";
