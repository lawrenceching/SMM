import { inspect } from 'node:util'
import type { AppContextInput, PlatformPortsInput } from '@smm/core'
import { NoopLoggerAdapter, TranslateSubtitleJob } from '@smm/core'
import { getCore } from '@smm/server'
import { CliLoggerAdapter } from '../cliLogger'

export interface TranslateOptions {
  folder: string
  translator: 'bing' | 'google' | 'llm'
  targetLanguage: string
  reflect?: boolean
  layout?: 'target-above' | 'source-above' | 'target-only' | 'source-only'
  apiKey?: string
  apiBase?: string
  model?: string
  title?: string
  media?: string
  verbose?: boolean
  /** Test-only: override Core AppContext fields. */
  _context?: Partial<AppContextInput>
  /** Test-only: override Core platform ports. */
  _ports?: Partial<PlatformPortsInput>
}

/**
 * Translate one subtitle file via Core {@link TranslateSubtitleJob}.
 * @returns Process exit code (0 success, 1 on error).
 */
export async function translate(subtitle: string, options: TranslateOptions): Promise<number> {
  try {
    const verbose = Boolean(options.verbose)
    const core = getCore({
      logger: verbose ? new CliLoggerAdapter(true) : new NoopLoggerAdapter(),
      _context: options._context,
      _ports: options._ports,
    })

    const llm =
      options.translator === 'llm' && options.apiKey?.trim()
        ? {
            apiKey: options.apiKey.trim(),
            apiBase: options.apiBase?.trim() || undefined,
            model: options.model?.trim() || undefined,
          }
        : undefined

    const { id } = await core.translateSubtitle(
      {
        folder: options.folder,
        subtitlePath: subtitle,
        translator: options.translator,
        targetLanguage: options.targetLanguage,
        reflect: options.reflect,
        layout: options.layout,
        title: options.title,
        mediaPath: options.media,
        llm,
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
        job instanceof TranslateSubtitleJob
          ? (job.toJSON().error ?? `status ${job.status}`)
          : `status ${job.status}`
      console.error(`Translate failed: ${detail}`)
      return 1
    }
    return 0
  } catch (error) {
    console.error('Unknown error during translate: ' + inspect(error))
    return 1
  }
}
