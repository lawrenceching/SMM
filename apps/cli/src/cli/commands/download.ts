import { readFileSync } from 'node:fs'
import { inspect } from 'node:util'
import type { AppContextInput, PlatformPortsInput } from '@smm/core'
import { NoopLoggerAdapter, YtdlpJob } from '@smm/core'
import { isYoutubeDownloadUrl } from '@smm/core/download-video-cookie-platform'
import { resolveYtdlpFormatFlag } from '@smm/core/whitelistedCmd/ytdlp'
import { discoverQuickjs, getCore } from '@smm/server'
import { CliLoggerAdapter } from '../cliLogger'

export interface DownloadOptions {
  folder: string
  format?: string
  proxy?: string
  cookiesFromBrowser?: string
  /** Path to a Netscape cookies file; CLI reads the body and passes cookiesText to Core. */
  cookies?: string
  title?: string
  verbose?: boolean
  /** Test-only: override Core AppContext fields. */
  _context?: Partial<AppContextInput>
  /** Test-only: override Core platform ports. */
  _ports?: Partial<PlatformPortsInput>
}

/**
 * Download one video URL via Core {@link YtdlpJob}.
 * @returns Process exit code (0 success, 1 on error).
 */
export async function download(url: string, options: DownloadOptions): Promise<number> {
  try {
    const verbose = Boolean(options.verbose)
    const core = getCore({
      logger: verbose ? new CliLoggerAdapter(true) : new NoopLoggerAdapter(),
      _context: options._context,
      _ports: options._ports,
    })

    let cookiesText: string | undefined
    if (options.cookies?.trim()) {
      cookiesText = readFileSync(options.cookies.trim(), 'utf-8')
    }

    const format = resolveYtdlpFormatFlag(options.format)

    let jsRuntime: string | undefined
    let jsRuntimePath: string | undefined
    if (isYoutubeDownloadUrl(url)) {
      const quickjs = await discoverQuickjs()
      if (quickjs) {
        jsRuntime = 'quickjs'
        jsRuntimePath = quickjs
      } else if (verbose) {
        console.warn('QuickJS not found; YouTube download may fail without a JS runtime')
      }
    }

    const { id } = await core.downloadVideo(
      {
        url,
        folder: options.folder,
        title: options.title,
        format,
        proxy: options.proxy,
        cookiesFromBrowser: options.cookiesFromBrowser,
        cookiesText,
        jsRuntime,
        jsRuntimePath,
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
        job instanceof YtdlpJob
          ? (job.toJSON().error ?? `status ${job.status}`)
          : `status ${job.status}`
      console.error(`Download failed: ${detail}`)
      return 1
    }
    return 0
  } catch (error) {
    console.error('Unknown error during download: ' + inspect(error))
    return 1
  }
}
