import { NoopLoggerAdapter } from '@smm/core'
import type { AppContextInput, PlatformPortsInput } from '@smm/core'
import { getCore } from '@smm/server'
import { CliLoggerAdapter } from '../cliLogger'
import { formatScrapeJobTaskLines } from '../scrapeJobFormat'
import { waitUntilScrapeSettled } from '../waitScrapeJob'

const SCRAPE_WAIT_TIMEOUT_MS = 5 * 60 * 1000

export interface ScrapeOptions {
  language?: string
  wait?: boolean
  verbose?: boolean
  /** Test-only: override Core AppContext fields. */
  _context?: Partial<AppContextInput>
  /** Test-only: override Core platform ports (fs / network / logger / discover). */
  _ports?: Partial<PlatformPortsInput>
}

/**
 * Start a scrape job for an imported media folder.
 * Prints the job id. With `wait`, waits until the job settles and prints per-task status icons.
 * @returns Process exit code (0 success, 1 on error).
 */
export async function scrape(folder: string, options: ScrapeOptions): Promise<number> {
  try {
    const verbose = Boolean(options.verbose)
    const core = getCore({
      logger: verbose ? new CliLoggerAdapter(true) : new NoopLoggerAdapter(),
      _context: options._context,
      _ports: options._ports,
    })
    const { id } = await core.scrapeFolder({
      path: folder,
      language: options.language,
      callbacks: {
        onLog: (message: string) => {
          if (verbose) console.log(message)
        },
      },
    })

    console.log(id)
    if (!options.wait) return 0

    const job = await waitUntilScrapeSettled(core, id, {
      timeoutMs: SCRAPE_WAIT_TIMEOUT_MS,
    })
    for (const line of formatScrapeJobTaskLines(job)) {
      console.log(line)
    }
    if (job.status !== 'succeeded') {
      return 1
    }
    return 0
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    return 1
  }
}
