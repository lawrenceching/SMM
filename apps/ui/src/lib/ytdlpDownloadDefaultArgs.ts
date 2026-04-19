/**
 * Default yt-dlp CLI flags for `POST /api/ytdlp/download`.
 * Not part of {@link import('@/types/background-jobs').DownloadVideoBackgroundJobData} (see docs/design/download-bilibili-videos.md).
 */
export const YTDLP_DOWNLOAD_DEFAULT_ARGS: string[] = [
  '--write-thumbnail',
  '--embed-thumbnail',
  '--embed-metadata',
]
