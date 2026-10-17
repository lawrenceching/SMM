import { inspect } from 'node:util'
import type { AppContextInput, PlatformPortsInput } from '@smm/core'
import { NoopLoggerAdapter, ProcessSubtitleJob } from '@smm/core'
import { getCore } from '@smm/server'
import { CliLoggerAdapter } from '../cliLogger'

export interface ProcessSubtitleOptions {
  folder: string
  asr?: 'bijian' | 'jianying' | 'whisper-cpp'
  language?: string
  format?: 'srt' | 'ass' | 'txt' | 'json'
  wordTimestamps?: boolean
  noOptimize?: boolean
  noSplit?: boolean
  noTranslate?: boolean
  translator?: 'bing' | 'google' | 'llm'
  targetLanguage?: string
  reflect?: boolean
  layout?: 'target-above' | 'source-above' | 'target-only' | 'source-only'
  prompt?: string
  apiKey?: string
  apiBase?: string
  model?: string
  noSynthesize?: boolean
  subtitleMode?: 'soft' | 'hard'
  quality?: 'ultra' | 'high' | 'medium' | 'low'
  style?: string
  renderMode?: 'ass' | 'rounded'
  synthesizeLayout?: 'target-above' | 'source-above' | 'target-only' | 'source-only'
  title?: string
  verbose?: boolean
  /** Test-only: override Core AppContext fields. */
  _context?: Partial<AppContextInput>
  /** Test-only: override Core platform ports. */
  _ports?: Partial<PlatformPortsInput>
}

/**
 * Run the full subtitle process pipeline via Core {@link ProcessSubtitleJob}.
 * @returns Process exit code (0 success, 1 on error).
 */
export async function processSubtitle(
  media: string,
  options: ProcessSubtitleOptions,
): Promise<number> {
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

    const { id } = await core.processSubtitle(
      {
        folder: options.folder,
        mediaPath: media,
        asr: options.asr,
        language: options.language,
        wordTimestamps: options.wordTimestamps,
        format: options.format,
        noOptimize: options.noOptimize,
        noSplit: options.noSplit,
        noTranslate: options.noTranslate,
        translator: options.translator,
        targetLanguage: options.targetLanguage,
        reflect: options.reflect,
        layout: options.layout,
        prompt: options.prompt,
        llm,
        noSynthesize: options.noSynthesize,
        subtitleMode: options.subtitleMode,
        quality: options.quality,
        style: options.style,
        renderMode: options.renderMode,
        synthesizeLayout: options.synthesizeLayout,
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
        job instanceof ProcessSubtitleJob
          ? (job.toJSON().error ?? `status ${job.status}`)
          : `status ${job.status}`
      console.error(`Process failed: ${detail}`)
      return 1
    }
    return 0
  } catch (error) {
    console.error('Unknown error during process: ' + inspect(error))
    return 1
  }
}
