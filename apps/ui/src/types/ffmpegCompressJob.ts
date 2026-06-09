/**
 * FfmpegCompress job types.
 *
 * Compression jobs share the existing `ffmpeg-convert` job pipeline; the
 * orchestrator branches on the presence of `compressOptions` in the data
 * payload. These types provide a stronger shape for compression jobs to
 * make call sites in the dialog / factory self-documenting.
 */
import type { FfmpegCompressOptions } from '@core/whitelistedCmd/constants'
import type {
  FfmpegConvertBackgroundJob,
  FfmpegConvertBackgroundJobData,
} from './background-jobs'

/** A {@link FfmpegConvertBackgroundJobData} with `compressOptions` required. */
export type FfmpegCompressBackgroundJobData = FfmpegConvertBackgroundJobData & {
  compressOptions: FfmpegCompressOptions
  /** Always one of the four 'compress-*' opaque format values. */
  outputFormat:
    | 'compress-mp4'
    | 'compress-mkv'
    | 'compress-webm'
    | 'compress-mov'
}

/** A {@link FfmpegConvertBackgroundJob} that carries compression options. */
export type FfmpegCompressBackgroundJob = FfmpegConvertBackgroundJob & {
  data: FfmpegCompressBackgroundJobData
}
