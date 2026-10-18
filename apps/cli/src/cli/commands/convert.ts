import { inspect } from 'node:util'
import type { AppContextInput, PlatformPortsInput } from '@smm/core'
import { FfmpegConvertJob, NoopLoggerAdapter } from '@smm/core'
import type {
  FfmpegConvertFormat,
  FfmpegConvertPreset,
} from '@smm/core/whitelistedCmd/constants'
import { getCore } from '@smm/server'
import { CliLoggerAdapter } from '../cliLogger'

export interface ConvertOptions {
  folder: string
  output: string
  format: FfmpegConvertFormat
  preset: FfmpegConvertPreset
  title?: string
  verbose?: boolean
  /** Test-only: override Core AppContext fields. */
  _context?: Partial<AppContextInput>
  /** Test-only: override Core platform ports. */
  _ports?: Partial<PlatformPortsInput>
}

/**
 * Convert a video via Core {@link FfmpegConvertJob}.
 * @returns Process exit code (0 success, 1 on error).
 */
export async function convert(input: string, options: ConvertOptions): Promise<number> {
  try {
    const verbose = Boolean(options.verbose)
    const core = getCore({
      logger: verbose ? new CliLoggerAdapter(true) : new NoopLoggerAdapter(),
      _context: options._context,
      _ports: options._ports,
    })

    const { id } = await core.ffmpegConvert(
      {
        folder: options.folder,
        inputPath: input,
        outputPath: options.output,
        outputFormat: options.format,
        preset: options.preset,
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
        job instanceof FfmpegConvertJob
          ? (job.toJSON().error ?? `status ${job.status}`)
          : `status ${job.status}`
      console.error(`Convert failed: ${detail}`)
      return 1
    }
    return 0
  } catch (error) {
    console.error('Unknown error during convert: ' + inspect(error))
    return 1
  }
}
