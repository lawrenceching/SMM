

interface DownloadingTrack {
  url?: string
  status?: "pending" | "downloading" | "completed" | "failed" | "stopped";
  /** When set, this row is backed by a {@link import('@/types/background-jobs').DownloadVideoBackgroundJob} */
  jobId?: string
  /**
   * CLI command execution id for the parent download-video job. Used by
   * progress hooks to poll main.log for yt-dlp progress JSON lines.
   * Mirrors `BackgroundJob.data.executionId` of the same jobId.
   */
  executionId?: string
}

/**
 * **Temporary Track** The track that is downloading from the internet. The track that has status property is temporary track.
 * **Permanent Track** The track that is already downloaded and saved in the local storage.
 */
export interface Track extends DownloadingTrack {
  id: number;
  title: string;
  artist: string;
  duration: number;
  thumbnail?: string;
  addedDate: Date;
  /**
   * The absolute path of the track file, in platform-specific format.
   * If path is undefined, this track is temporary for downloading video.
   */
  path?: string;
}
