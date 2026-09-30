import type { AppContextInput, FolderType, PlatformPortsInput } from '@smm/core'
import { NoopLoggerAdapter } from '@smm/core'
import { inspect } from 'node:util'
import { getCore } from '../../core/getCore'
import { CliLoggerAdapter } from '../cliLogger'

const FOLDER_TYPES: readonly FolderType[] = ['tvshow', 'movie', 'music']

export interface AddOptions {
  type: string
  verbose?: boolean
  skipInit?: boolean
  /** Test-only: override Core AppContext fields. */
  _context?: Partial<AppContextInput>
  /** Test-only: override Core platform ports (fs / network / logger / discover). */
  _ports?: Partial<PlatformPortsInput>
}

function resolveFolderType(value: string): FolderType {
  if (value === 'anime') return 'tvshow'
  if ((FOLDER_TYPES as readonly string[]).includes(value)) {
    return value as FolderType
  }
  throw new Error(`Invalid folder type: ${value}`)
}

/**
 * Import a media folder and wait until the import job completes.
 * @returns Process exit code (0 success, 1 on error).
 */
export async function add(folder: string, options: AddOptions): Promise<number> {
  try {
    const type = resolveFolderType(options.type)
    const verbose = Boolean(options.verbose)
    const core = getCore({
      logger: verbose ? new CliLoggerAdapter(true) : new NoopLoggerAdapter(),
      _context: options._context,
      _ports: options._ports,
    })
    const { id } = await core.importFolder(folder, type, {
      onLog: (message: string) => {
        console.log(message)
      },
    })

    const job = core.getJob(id)
    if (job === undefined) {
      console.error(`Job not found: ${id}`)
      return 1
    }
    await core.waitForJobUntilCompleted(id)
    return 0
  } catch (error) {
    console.error('Unknown error during import folder: ' + inspect(error))
    return 1
  }
}
