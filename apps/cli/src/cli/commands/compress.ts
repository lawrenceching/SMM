import { inspect } from 'node:util'
import type { AppContextInput, PlatformPortsInput } from '@smm/core'
import { FfmpegCompressJob, NoopLoggerAdapter } from '@smm/core'
import {
  DEFAULT_FFMPEG_COMPRESS_OPTIONS,
  type FfmpegCompressContainer,
  type FfmpegCompressOptions,
  type FfmpegCompressPresetKey,
} from '@smm/core/whitelistedCmd/constants'
import { getCore } from '@smm/server'
import { CliLoggerAdapter } from '../cliLogger'

export interface CompressOptions {
  folder: string
  output: string
  container: FfmpegCompressContainer
  /** Override DEFAULT_FFMPEG_COMPRESS_OPTIONS.presetKey */
  presetKey?: FfmpegCompressPresetKey
  /** Override DEFAULT_FFMPEG_COMPRESS_OPTIONS.crf */
  crf?: number
  /** Override DEFAULT_FFMPEG_COMPRESS_OPTIONS.videoEncoder */
  videoEncoder?: string
  /** Override DEFAULT_FFMPEG_COMPRESS_OPTIONS.twoPass */
  twoPass?: boolean
  title?: string
  verbose?: boolean
  /** Test-only: override Core AppContext fields. */
  _context?: Partial<AppContextInput>
  /** Test-only: override Core platform ports. */
  _ports?: Partial<PlatformPortsInput>
}

function buildCompressOptions(options: CompressOptions): FfmpegCompressOptions {
  return {
    ...DEFAULT_FFMPEG_COMPRESS_OPTIONS,
    container: options.container,
    ...(options.presetKey !== undefined ? { presetKey: options.presetKey } : {}),
    ...(options.crf !== undefined ? { crf: options.crf } : {}),
    ...(options.videoEncoder !== undefined ? { videoEncoder: options.videoEncoder } : {}),
    ...(options.twoPass !== undefined ? { twoPass: options.twoPass } : {}),
  }
}

/**
 * Compress a video via Core {@link FfmpegCompressJob}.
 * @returns Process exit code (0 success, 1 on error).
 */
export async function compress(input: string, options: CompressOptions): Promise<number> {
  try {
    const verbose = Boolean(options.verbose)
    const core = getCore({
      logger: verbose ? new CliLoggerAdapter(true) : new NoopLoggerAdapter(),
      _context: options._context,
      _ports: options._ports,
    })

    const { id } = await core.ffmpegCompress(
      {
        folder: options.folder,
        inputPath: input,
        outputPath: options.output,
        compressOptions: buildCompressOptions(options),
        title: options.title,
      },
      {
        onLog: (message: string) => {
          console.log(message)
        },
      },
    )

    const job = core.getJob(id)
    if (job === undefined) {
      console.error(`Job not found: ${id}`)
      return 1
    }

    await core.waitForJobUntilCompleted(id)

    if (job.status !== 'succeeded') {
      const detail =
        job instanceof FfmpegCompressJob
          ? (job.toJSON().error ?? `status ${job.status}`)
          : `status ${job.status}`
      console.error(`Compress failed: ${detail}`)
      return 1
    }
    return 0
  } catch (error) {
    console.error('Unknown error during compress: ' + inspect(error))
    return 1
  }
}
