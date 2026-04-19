/**
 * Background job status type
 */
export type JobStatus = 'pending' | 'running' | 'failed' | 'succeeded' | 'aborted';

/** Per-video row in a download-video job (see docs/design/download-bilibili-videos.md) */
export type DownloadVideoItemStatus = 'pending' | 'downloading' | 'succeeded' | 'failed';

export interface BackgroundJobBase {
  /** Unique identifier for the job */
  id: string;

  /** Human-readable name of the job */
  name: string;

  /** Current status of the job */
  status: JobStatus;

  /** Progress percentage (0-100) */
  progress: number;

  /** Discriminator for typed jobs */
  type: string;

  /** Type-specific payload */
  data: unknown;
}

/** Legacy / generic jobs (e.g. folder initialization) */
export interface GenericBackgroundJob extends BackgroundJobBase {
  type: 'generic';
  data: Record<string, never>;
}

/** One row in {@link DownloadVideoBackgroundJobData.videos} */
export interface DownloadVideoJobVideo {
  url: string;
  artist: string;
  title: string;
  status: DownloadVideoItemStatus;
}

/** As in docs/design/download-bilibili-videos.md */
export interface DownloadVideoBackgroundJobData {
  folder: string;
  videos: DownloadVideoJobVideo[];
}

export interface DownloadVideoBackgroundJob extends BackgroundJobBase {
  type: 'download-video';
  data: DownloadVideoBackgroundJobData;
}

export type BackgroundJob = GenericBackgroundJob | DownloadVideoBackgroundJob;

export function isDownloadVideoJob(job: BackgroundJob): job is DownloadVideoBackgroundJob {
  return job.type === 'download-video';
}

export function isGenericBackgroundJob(job: BackgroundJob): job is GenericBackgroundJob {
  return job.type === 'generic';
}
