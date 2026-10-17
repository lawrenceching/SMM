import { inspect } from 'node:util'
import type { AppContextInput, PlatformPortsInput } from '@smm/core'
import { NoopLoggerAdapter, SynthesizeSubtitleJob } from '@smm/core'
import { getCore } from '@smm/server'
import { CliLoggerAdapter } from '../cliLogger'

export interface SynthesizeOptions {
  folder: string
  subtitle: string
  subtitleMode?: 'soft' | 'hard'
  quality?: 'ultra' | 'high' | 'medium' | 'low'
  style?: string
  renderMode?: 'ass' | 'rounded'
  layout?: 'target-above' | 'source-above' | 'target-only' | 'source-only'
  title?: string
  verbose?: boolean
  /** Test-only: override Core AppContext fields. */
  _context?: Partial<AppContextInput>
  /** Test-only: override Core platform ports. */
  _ports?: Partial<PlatformPortsInput>
}

/**
 * Synthesize subtitles onto a video via Core {@link SynthesizeSubtitleJob}.
 * @returns Process exit code (0 success, 1 on error).
 */
export async function synthesize(video: string, options: SynthesizeOptions): Promise<number> {
  try {
    const verbose = Boolean(options.verbose)
    const core = getCore({
      logger: verbose ? new CliLoggerAdapter(true) : new NoopLoggerAdapter(),
      _context: options._context,
      _ports: options._ports,
    })

    const { id } = await core.synthesizeSubtitle(
      {
        folder: options.folder,
        videoPath: video,
        subtitlePath: options.subtitle,
        subtitleMode: options.subtitleMode,
        quality: options.quality,
        style: options.style,
        renderMode: options.renderMode,
        layout: options.layout,
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
        job instanceof SynthesizeSubtitleJob
          ? (job.toJSON().error ?? `status ${job.status}`)
          : `status ${job.status}`
      console.error(`Synthesize failed: ${detail}`)
      return 1
    }
    return 0
  } catch (error) {
    console.error('Unknown error during synthesize: ' + inspect(error))
    return 1
  }
}
