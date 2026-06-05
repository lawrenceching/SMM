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

export type FfmpegConvertFormat =
  | "mp4h264"
  | "mp4h265"
  | "webm"
  | "mkv"
  | "avif"
  | "webp"
  | "apng";

export type FfmpegConvertPreset = "quality" | "balanced" | "speed";

export type FfmpegConvertImageLoop = "once" | "infinite";

export type FfmpegConvertWebpPreset =
  | "default"
  | "picture"
  | "photo"
  | "drawing"
  | "icon"
  | "text";

export type FfmpegConvertApngPred = "none" | "sub" | "up" | "avg" | "paeth" | "mixed";

export interface FfmpegConvertImageOptions {
  mode: "animated" | "still";
  fps: number;
  maxWidth: number;
  avif: {
    crf: number;
    cpuUsed: number;
    loop: FfmpegConvertImageLoop;
  };
  webp: {
    lossless: boolean;
    quality: number;
    preset: FfmpegConvertWebpPreset;
    loop: FfmpegConvertImageLoop;
  };
  apng: {
    pred: FfmpegConvertApngPred;
    loop: FfmpegConvertImageLoop;
  };
}

export const DEFAULT_FFMPEG_CONVERT_IMAGE_OPTIONS: FfmpegConvertImageOptions = {
  mode: "animated",
  fps: 10,
  maxWidth: 0,
  avif: { crf: 30, cpuUsed: 4, loop: "once" },
  webp: { lossless: false, quality: 80, preset: "default", loop: "once" },
  apng: { pred: "paeth", loop: "once" },
};

export function isFfmpegConvertImageFormat(format: FfmpegConvertFormat): boolean {
  return format === "avif" || format === "webp" || format === "apng";
}
