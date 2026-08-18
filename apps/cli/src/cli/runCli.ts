import { Command, Option } from 'commander'
import type { FolderType } from 'core-app'
import { NoopLoggerAdapter } from 'core-app'
import { getCore } from '../core/getCore'
import { waitUntilImportSettled } from './addProgress'
import { CliLoggerAdapter } from './cliLogger'
import {
  formatMediaMetadata,
  formatShowFolder,
  isFolderImported,
  resolveShowFolder,
} from './folderDisplay'

const FOLDER_TYPES: readonly FolderType[] = ['tvshow', 'movie', 'music']
const TYPE_CHOICES = [...FOLDER_TYPES, 'anime'] as const

function resolveFolderType(value: string): FolderType {
  if (value === 'anime') return 'tvshow'
  if ((FOLDER_TYPES as readonly string[]).includes(value)) {
    return value as FolderType
  }
  throw new Error(`Invalid folder type: ${value}`)
}

const IMPORT_WAIT_TIMEOUT_MS = 5 * 60 * 1000

/**
 * Run the `smm` Commander program (`list`, `add`, `show`, `metadata`, `rm`).
 * @param argv Full process argv (e.g. `['node', 'smm', 'list']`).
 * @returns Process exit code (0 success, 1 on error).
 */
export async function runCli(argv: string[] = process.argv): Promise<number> {
  let exitCode = 0

  const program = new Command()
  program.name('smm').exitOverride()

  program
    .command('list')
    .description('List imported media folder paths')
    .action(async () => {
      try {
        const folders = await getCore().getFolders()
        for (const folder of folders) {
          console.log(folder)
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error(message)
        exitCode = 1
      }
    })

  program
    .command('add')
    .description('Import a media folder and wait until initialization succeeds')
    .argument('<folder>', 'Folder path to import')
    .addOption(
      new Option('--type <type>', 'Folder type (anime is an alias for tvshow)')
        .choices([...TYPE_CHOICES])
        .makeOptionMandatory(),
    )
    .option('-v, --verbose', 'Print detailed logs')
    .action(async (folder: string, opts: { type: string; verbose?: boolean }) => {
      try {
        const type = resolveFolderType(opts.type)
        const verbose = Boolean(opts.verbose)
        const core = getCore({
          logger: verbose ? new CliLoggerAdapter(true) : new NoopLoggerAdapter(),
        })
        const { id } = core.importFolder(folder, type)
        const job = await waitUntilImportSettled(core, id, {
          folder,
          type,
          timeoutMs: IMPORT_WAIT_TIMEOUT_MS,
        })
        if (job.status !== 'succeeded') {
          console.error(job.error ?? `Import failed with status ${job.status}`)
          exitCode = 1
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error(message)
        exitCode = 1
      }
    })

  program
    .command('show')
    .description('Show imported folder status (UI-aligned)')
    .argument('<folder>', 'Folder path')
    .action(async (folder: string) => {
      try {
        const resolved = await resolveShowFolder(folder)
        if (!resolved.ok) {
          console.error(resolved.error)
          exitCode = 1
          return
        }
        for (const line of formatShowFolder(resolved.result)) {
          console.log(line)
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error(message)
        exitCode = 1
      }
    })

  program
    .command('metadata')
    .description('Show human-readable media metadata for an imported folder')
    .argument('<folder>', 'Folder path')
    .action(async (folder: string) => {
      try {
        if (!(await isFolderImported(folder))) {
          console.error(`Folder is not imported: ${folder}`)
          exitCode = 1
          return
        }
        const mm = await getCore().getMediaMetadata(folder)
        if (mm === null) {
          console.error(`No metadata cache for folder: ${folder}`)
          exitCode = 1
          return
        }
        for (const line of formatMediaMetadata(folder, mm)) {
          console.log(line)
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error(message)
        exitCode = 1
      }
    })

  program
    .command('rm')
    .description('Unimport a media folder (remove from config and delete metadata cache)')
    .argument('<folder>', 'Folder path to unimport')
    .action(async (folder: string) => {
      try {
        if (!(await isFolderImported(folder))) {
          console.error(`Folder is not imported: ${folder}`)
          exitCode = 1
          return
        }
        await getCore().unimportFolder(folder)
        console.log(`Removed ${folder}`)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error(message)
        exitCode = 1
      }
    })

  try {
    await program.parseAsync(argv, { from: 'node' })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(message)
    exitCode = 1
  }

  return exitCode
}
