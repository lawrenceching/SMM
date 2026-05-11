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

/** Subtitle/text output format (VideoCaptioner CLI). */
export type TranscribeOutputFormat = 'srt' | 'ass' | 'txt' | 'json';

/** ASR engine id for VideoCaptioner `transcribe --asr`. */
export type TranscribeVideoCaptionerAsr = 'bijian' | 'jianying' | 'whisper-cpp';

export interface TranscribeBackgroundJobData {
  /** Media library folder (platform path), matches `TaskJobRecord.folder` for filtering. */
  folder: string;
  /** Absolute media file path (POSIX); used to match library rows in the UI. */
  mediaPath: string;
  /** Platform path for videocaptioner/tencent transcribe API request bodies (main thread). */
  mediaPathPlatform: string;
  title: string;
  provider: 'videoCaptioner' | 'tencentAsr';
  videoCaptioner?: {
    asr?: TranscribeVideoCaptionerAsr;
    language?: string;
    wordTimestamps?: boolean;
    format?: TranscribeOutputFormat;
  };
  tencentAsr?: {
    baseUrl: string;
    apiKey: string;
  };
}

export interface TranscribeBackgroundJob extends BackgroundJobBase {
  type: 'transcribe';
  data: TranscribeBackgroundJobData;
}

export type BackgroundJob = GenericBackgroundJob | DownloadVideoBackgroundJob | TranscribeBackgroundJob;

export function isDownloadVideoJob(job: BackgroundJob): job is DownloadVideoBackgroundJob {
  return job.type === 'download-video';
}

export function isGenericBackgroundJob(job: BackgroundJob): job is GenericBackgroundJob {
  return job.type === 'generic';
}

export function isTranscribeBackgroundJob(job: BackgroundJob): job is TranscribeBackgroundJob {
  return job.type === 'transcribe';
}
