import type { AppContextInput, PlatformPortsInput } from '@smm/core'
import { NoopLoggerAdapter } from '@smm/core'
import { inspect } from 'node:util'
import { getCore } from '@smm/server'
import { CliLoggerAdapter } from '../cliLogger'
import { resolveFolderType } from './shared'

export interface AddlibOptions {
  type: string
  verbose?: boolean
  skipInit?: boolean
  concurrency?: number
  /** Test-only: override Core AppContext fields. */
  _context?: Partial<AppContextInput>
  /** Test-only: override Core platform ports (fs / network / logger / discover). */
  _ports?: Partial<PlatformPortsInput>
}

/**
 * Import every media folder under a library directory and wait until the job completes.
 * @returns Process exit code (0 success, 1 on error).
 */
export async function addlib(library: string, options: AddlibOptions): Promise<number> {
  try {
    const type = resolveFolderType(options.type)
    const verbose = Boolean(options.verbose)
    const core = getCore({
      logger: verbose ? new CliLoggerAdapter(true) : new NoopLoggerAdapter(),
      _context: options._context,
      _ports: options._ports,
    })
    const { id } = await core.importLibrary({
      path: library,
      type,
      skipInit: options.skipInit ?? false,
      concurrency: options.concurrency,
      callbacks: {
        onLog: (message: string) => {
          console.log(message)
        },
      },
    })

    const job = core.getJob(id)
    if (job === undefined) {
      console.error(`Job not found: ${id}`)
      return 1
    }
    await core.waitForJobUntilCompleted(id)
    if (job.status !== 'succeeded') {
      console.error(`Import library failed with status ${job.status}`)
      return 1
    }
    return 0
  } catch (error) {
    console.error('Unknown error during import library: ' + inspect(error))
    return 1
  }
}
