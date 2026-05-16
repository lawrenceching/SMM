export const YTDLP_FORMAT_PRESET_IDS = [
  "default",
  "best",
  "1080p",
  "720p",
  "audio",
] as const;

export type YtdlpFormatPresetId = (typeof YTDLP_FORMAT_PRESET_IDS)[number];

export interface YtdlpFormatPreset {
  id: YtdlpFormatPresetId;
  /** yt-dlp `-f` selector; omitted for automatic default. */
  format?: string;
}

export const YTDLP_FORMAT_PRESETS: readonly YtdlpFormatPreset[] = [
  { id: "default" },
  { id: "best", format: "bestvideo*+ba/b" },
  { id: "1080p", format: "bv*[height<=1080]+ba/b[height<=1080]/best" },
  { id: "720p", format: "bv*[height<=720]+ba/b[height<=720]/best" },
  { id: "audio", format: "bestaudio/best" },
];

const PRESET_BY_ID = new Map<string, YtdlpFormatPreset>(
  YTDLP_FORMAT_PRESETS.map((p) => [p.id, p])
);

export function isYtdlpFormatPresetId(value: string): value is YtdlpFormatPresetId {
  return PRESET_BY_ID.has(value);
}

/** Maps a preset id to the yt-dlp `-f` string, or `undefined` for automatic / unknown. */
export function resolveYtdlpFormatFromPreset(presetId: string): string | undefined {
  const preset = PRESET_BY_ID.get(presetId) ?? PRESET_BY_ID.get("default");
  const format = preset?.format?.trim();
  return format || undefined;
}

export type DownloadVideoFormatPresetLabelKey =
  | "downloadVideo.formatDefault"
  | "downloadVideo.formatBest"
  | "downloadVideo.format1080p"
  | "downloadVideo.format720p"
  | "downloadVideo.formatAudioOnly";

const PRESET_LABEL_KEYS: Record<YtdlpFormatPresetId, DownloadVideoFormatPresetLabelKey> = {
  default: "downloadVideo.formatDefault",
  best: "downloadVideo.formatBest",
  "1080p": "downloadVideo.format1080p",
  "720p": "downloadVideo.format720p",
  audio: "downloadVideo.formatAudioOnly",
};

/** i18n key under `dialogs` namespace for each preset label. */
export function ytdlpFormatPresetLabelKey(id: YtdlpFormatPresetId): DownloadVideoFormatPresetLabelKey {
  return PRESET_LABEL_KEYS[id];
}
