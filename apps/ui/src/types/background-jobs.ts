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

  /**
   * Batch identifier shared by jobs created together.
   * When one job in a batch fails, all pending siblings with the same
   * parentId are automatically cancelled before the next job starts.
   */
  parentId?: string;
}

/** Legacy / generic jobs (e.g. folder initialization) */
export interface GenericBackgroundJob extends BackgroundJobBase {
  type: 'generic';
  data: Record<string, never>;
}

/** Developer test job with configurable delay and outcome (persisted in IndexedDB). */
export interface TestDelayBackgroundJobData {
  delayMs: number;
  outcome: 'succeeded' | 'failed';
  /** Set when the job enters `running`; used to resume after page refresh. */
  startedAt?: number;
}

export interface TestDelayBackgroundJob extends BackgroundJobBase {
  type: 'test-delay';
  data: TestDelayBackgroundJobData;
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
  /** yt-dlp `-f` format applied to every video in this job. */
  ytdlpFormat?: string;
  /** Absolute path to Netscape cookies file for `--cookies` on every video. */
  ytdlpCookiesFile?: string;
  /** Browser profile for `--cookies-from-browser` (chrome, edge, firefox). */
  ytdlpCookiesFromBrowser?: string;
  /** Allow-listed yt-dlp flags (--write-thumbnail, --embed-thumbnail, --embed-metadata). */
  ytdlpExtraArgs?: string[];
  /** CLI command log correlation (executeCmd yt-dlp). */
  executionId?: string;
  logRelativePath?: string;
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
  /** CLI command log correlation when available (VideoCaptioner API). */
  executionId?: string;
  logRelativePath?: string;
}

export interface TranscribeBackgroundJob extends BackgroundJobBase {
  type: 'transcribe';
  data: TranscribeBackgroundJobData;
}

/** Translator for VideoCaptioner `subtitle --translator`. */
export type TranslateTranslator = 'bing' | 'google' | 'llm';

/** Layout for VideoCaptioner `subtitle --layout`. */
export type TranslateSubtitleLayout = 'target-above' | 'source-above' | 'target-only' | 'source-only';

export interface TranslateBackgroundJobData {
  /** Media library folder (platform path), matches `TaskJobRecord.folder` for filtering. */
  folder: string;
  /** Absolute source subtitle path (POSIX); used for job identity and API. */
  subtitlePath: string;
  /** Platform path for VideoCaptioner translate executeCmd args. */
  subtitlePathPlatform: string;
  /** Associated media file path (POSIX); used for row-status mapping in MusicPanel. */
  mediaPath?: string;
  /** Platform path for media file when present. */
  mediaPathPlatform?: string;
  title: string;
  translator: TranslateTranslator;
  targetLanguage: string;
  reflect?: boolean;
  layout?: TranslateSubtitleLayout;
  llm?: {
    apiKey: string;
    apiBase?: string;
    model?: string;
  };
  executionId?: string;
  logRelativePath?: string;
}

export interface TranslateBackgroundJob extends BackgroundJobBase {
  type: 'translate';
  data: TranslateBackgroundJobData;
}

export type SynthesizeSubtitleMode = 'soft' | 'hard'
export type SynthesizeQuality = 'ultra' | 'high' | 'medium' | 'low'
export type SynthesizeRenderMode = 'ass' | 'rounded'
export type SynthesizeSubtitleLayout = 'target-above' | 'source-above' | 'target-only' | 'source-only'

export interface SynthesizeBackgroundJobData {
  /** Media library folder (platform path). */
  folder: string
  /** Absolute video file path (POSIX). */
  videoPath: string
  videoPathPlatform: string
  /** Absolute subtitle file path (POSIX). */
  subtitlePath: string
  subtitlePathPlatform: string
  /** Same as videoPath when set; used for row-status mapping in MusicPanel. */
  mediaPath?: string
  mediaPathPlatform?: string
  title: string
  subtitleMode?: SynthesizeSubtitleMode
  quality?: SynthesizeQuality
  style?: string
  renderMode?: SynthesizeRenderMode
  layout?: SynthesizeSubtitleLayout
  executionId?: string
  logRelativePath?: string
}

export interface SynthesizeBackgroundJob extends BackgroundJobBase {
  type: 'synthesize'
  data: SynthesizeBackgroundJobData
}

/** Full VideoCaptioner `process` pipeline options (flat body for SW → API). */
export interface ProcessBackgroundJobData {
  folder: string
  mediaPath: string
  mediaPathPlatform: string
  title: string
  asr?: TranscribeVideoCaptionerAsr
  language?: string
  wordTimestamps?: boolean
  format?: TranscribeOutputFormat
  noOptimize?: boolean
  noTranslate?: boolean
  noSplit?: boolean
  translator?: TranslateTranslator
  targetLanguage?: string
  reflect?: boolean
  layout?: TranslateSubtitleLayout
  prompt?: string
  llm?: {
    apiKey: string
    apiBase?: string
    model?: string
  }
  noSynthesize?: boolean
  subtitleMode?: SynthesizeSubtitleMode
  quality?: SynthesizeQuality
  style?: string
  renderMode?: SynthesizeRenderMode
  synthesizeLayout?: SynthesizeSubtitleLayout
  executionId?: string
  logRelativePath?: string
}

export interface ProcessBackgroundJob extends BackgroundJobBase {
  type: 'process'
  data: ProcessBackgroundJobData
}

export type BackgroundJob =
  | GenericBackgroundJob
  | TestDelayBackgroundJob
  | DownloadVideoBackgroundJob
  | TranscribeBackgroundJob
  | TranslateBackgroundJob
  | SynthesizeBackgroundJob
  | ProcessBackgroundJob

export function isDownloadVideoJob(job: BackgroundJob): job is DownloadVideoBackgroundJob {
  return job.type === 'download-video';
}

export function isGenericBackgroundJob(job: BackgroundJob): job is GenericBackgroundJob {
  return job.type === 'generic';
}

export function isTestDelayBackgroundJob(job: BackgroundJob): job is TestDelayBackgroundJob {
  return job.type === 'test-delay';
}

export function isTranscribeBackgroundJob(job: BackgroundJob): job is TranscribeBackgroundJob {
  return job.type === 'transcribe';
}

export function isTranslateBackgroundJob(job: BackgroundJob): job is TranslateBackgroundJob {
  return job.type === 'translate';
}

export function isSynthesizeBackgroundJob(job: BackgroundJob): job is SynthesizeBackgroundJob {
  return job.type === 'synthesize'
}

export function isProcessBackgroundJob(job: BackgroundJob): job is ProcessBackgroundJob {
  return job.type === 'process'
}
