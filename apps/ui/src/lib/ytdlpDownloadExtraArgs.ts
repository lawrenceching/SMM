import { YTDLP_DOWNLOAD_ALLOWED_ARGS } from "@core/whitelistedCmd/constants";

export const YTDLP_DOWNLOAD_EXTRA_ARG_IDS = [
  ...YTDLP_DOWNLOAD_ALLOWED_ARGS,
] as const;

export type YtdlpDownloadExtraArgId = (typeof YTDLP_DOWNLOAD_EXTRA_ARG_IDS)[number];

export type YtdlpDownloadExtraArgSelection = Record<YtdlpDownloadExtraArgId, boolean>;

export const DEFAULT_YTDLP_DOWNLOAD_EXTRA_ARG_SELECTION: YtdlpDownloadExtraArgSelection = {
  "--write-thumbnail": false,
  "--embed-thumbnail": false,
  "--embed-metadata": false,
};

export type DownloadVideoExtraArgLabelKey =
  | "downloadVideo.writeThumbnail.label"
  | "downloadVideo.embedThumbnail.label"
  | "downloadVideo.embedMetadata.label";

const EXTRA_ARG_LABEL_KEYS: Record<YtdlpDownloadExtraArgId, DownloadVideoExtraArgLabelKey> = {
  "--write-thumbnail": "downloadVideo.writeThumbnail.label",
  "--embed-thumbnail": "downloadVideo.embedThumbnail.label",
  "--embed-metadata": "downloadVideo.embedMetadata.label",
};

/** i18n key under `dialogs` namespace for each extra-arg label. */
export function ytdlpDownloadExtraArgLabelKey(
  id: YtdlpDownloadExtraArgId,
): DownloadVideoExtraArgLabelKey {
  return EXTRA_ARG_LABEL_KEYS[id];
}

/** Builds allow-listed yt-dlp flags from checkbox selection (stable order). */
export function buildYtdlpExtraArgsFromSelection(
  selection: YtdlpDownloadExtraArgSelection,
): string[] {
  return YTDLP_DOWNLOAD_EXTRA_ARG_IDS.filter((id) => selection[id]);
}
