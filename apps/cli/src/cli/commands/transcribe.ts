import { inspect } from 'node:util'
import type { AppContextInput, PlatformPortsInput } from '@smm/core'
import { NoopLoggerAdapter, TranscribeSubtitleJob } from '@smm/core'
import { getCore } from '@smm/server'
import { CliLoggerAdapter } from '../cliLogger'

export interface TranscribeOptions {
  folder: string
  asr?: 'bijian' | 'jianying' | 'whisper-cpp'
  language?: string
  format?: 'srt' | 'ass' | 'txt' | 'json'
  wordTimestamps?: boolean
  title?: string
  verbose?: boolean
  /** Test-only: override Core AppContext fields. */
  _context?: Partial<AppContextInput>
  /** Test-only: override Core platform ports. */
  _ports?: Partial<PlatformPortsInput>
}

/**
 * Transcribe one media file via Core {@link TranscribeSubtitleJob}.
 * @returns Process exit code (0 success, 1 on error).
 */
export async function transcribe(media: string, options: TranscribeOptions): Promise<number> {
  try {
    const verbose = Boolean(options.verbose)
    const core = getCore({
      logger: verbose ? new CliLoggerAdapter(true) : new NoopLoggerAdapter(),
      _context: options._context,
      _ports: options._ports,
    })

    const { id } = await core.transcribeSubtitle(
      {
        folder: options.folder,
        mediaPath: media,
        asr: options.asr ?? 'bijian',
        language: options.language,
        wordTimestamps: options.wordTimestamps,
        format: options.format ?? 'srt',
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
        job instanceof TranscribeSubtitleJob
          ? (job.toJSON().error ?? `status ${job.status}`)
          : `status ${job.status}`
      console.error(`Transcribe failed: ${detail}`)
      return 1
    }
    return 0
  } catch (error) {
    console.error('Unknown error during transcribe: ' + inspect(error))
    return 1
  }
}
