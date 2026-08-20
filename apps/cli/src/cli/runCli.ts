import { Command, Option } from 'commander'
import { readFile } from 'node:fs/promises'
import type { FolderType, RenameRuleName } from 'core-app'
import type { MediaMetadata } from '@smm/core'
import { isUserConfigKey, NoopLoggerAdapter } from 'core-app'
import { getCore } from '../core/getCore'
import { waitUntilImportSettled } from './addProgress'
import { CliLoggerAdapter } from './cliLogger'
import { formatScrapeJobTaskLines } from './scrapeJobFormat'
import { waitUntilScrapeSettled } from './waitScrapeJob'
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

const RENAME_RULES: readonly RenameRuleName[] = ['plex', 'emby']

function resolveRenameRule(value: string): RenameRuleName {
  if ((RENAME_RULES as readonly string[]).includes(value)) {
    return value as RenameRuleName
  }
  throw new Error(`Unsupported rename rule: ${value}`)
}

/** Parse CLI value as JSON when possible; otherwise keep the raw string. */
function parseConfigValue(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return raw
  }
}

function printJson(value: unknown): void {
  console.log(JSON.stringify(value, null, 2))
}

const IMPORT_WAIT_TIMEOUT_MS = 5 * 60 * 1000
const SCRAPE_WAIT_TIMEOUT_MS = 5 * 60 * 1000

/**
 * Run the `smm` Commander program (`list`, `add`, `show`, `metadata`, `rm`, `try-to-recognize`, `try-to-rename`, `apply`, `scrape`, `job`, `config`).
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
    .option('--skip-init', 'Only register the folder in UserConfig; skip recognition and metadata')
    .action(async (folder: string, opts: { type: string; verbose?: boolean; skipInit?: boolean }) => {
      try {
        const type = resolveFolderType(opts.type)
        const verbose = Boolean(opts.verbose)
        const skipInit = Boolean(opts.skipInit)
        const core = getCore({
          logger: verbose ? new CliLoggerAdapter(true) : new NoopLoggerAdapter(),
        })
        const { id } = skipInit
          ? core.importFolder(folder, type, { skipInit: true })
          : core.importFolder(folder, type)
        const job = await waitUntilImportSettled(core, id, {
          folder,
          type,
          timeoutMs: IMPORT_WAIT_TIMEOUT_MS,
          progress: !skipInit,
        })
        if (job.status !== 'succeeded') {
          console.error(job.error ?? `Import failed with status ${job.status}`)
          exitCode = 1
          return
        }
        if (skipInit) {
          console.log(`imported folder ${folder}`)
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
    .description('Show or write media metadata for an imported folder')
    .argument('<folder>', 'Folder path')
    .option('--set <file>', 'Write media metadata from a JSON file')
    .action(async (folder: string, opts: { set?: string }) => {
      try {
        if (!(await isFolderImported(folder))) {
          console.error(`Folder is not imported: ${folder}`)
          exitCode = 1
          return
        }
        if (opts.set !== undefined) {
          const raw = await readFile(opts.set, 'utf-8')
          const mm = JSON.parse(raw) as MediaMetadata
          await getCore().setMetadata({ ...mm, mediaFolderPath: folder })
          console.log(`updated metadata for ${folder}`)
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

  program
    .command('try-to-recognize')
    .description('Build a pending recognize-media-file plan for a TV show folder')
    .argument('<folder>', 'Imported media folder path')
    .action(async (folder: string) => {
      try {
        const plan = await getCore().tryToRecognizeFolder(folder)
        console.log(`plan: ${plan.id}`)
        console.log(`task: ${plan.task}`)
        console.log(`status: ${plan.status}`)
        console.log(`folder: ${plan.mediaFolderPath}`)
        console.log('files:')
        if (plan.files.length === 0) {
          console.log('  (none)')
        } else {
          for (const f of plan.files) {
            const ep = `S${String(f.season).padStart(2, '0')}E${String(f.episode).padStart(2, '0')}`
            console.log(`  ${ep}  ${f.path}`)
          }
        }
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error))
        exitCode = 1
      }
    })

  program
    .command('try-to-rename')
    .description('Build a pending rename-files plan (plex/emby)')
    .argument('<folder>', 'Imported media folder path')
    .option('--rule <rule>', 'Naming rule: plex | emby', 'plex')
    .action(async (folder: string, opts: { rule: string }) => {
      try {
        const rule = resolveRenameRule(opts.rule)
        const plan = await getCore().tryToRenameFolder(folder, rule)
        console.log(`plan: ${plan.id}`)
        console.log(`task: ${plan.task}`)
        console.log(`status: ${plan.status}`)
        console.log(`folder: ${plan.mediaFolderPath}`)
        console.log('files:')
        if (plan.files.length === 0) {
          console.log('  (none)')
        } else {
          for (const f of plan.files) {
            console.log(`  ${f.from} → ${f.to}`)
          }
        }
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error))
        exitCode = 1
      }
    })

  program
    .command('apply')
    .description('Apply a pending plan by id (recognize-media-file or rename-files)')
    .argument('<planId>', 'Plan id from try-to-recognize or try-to-rename')
    .action(async (planId: string) => {
      try {
        const plan = await getCore().getPlan(planId)
        await getCore().applyPlan(plan)
        const count =
          plan.task === 'recognize-media-file' || plan.task === 'rename-files'
            ? plan.files.length
            : 0
        console.log(`applied ${plan.id} (${count} file(s))`)
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error))
        exitCode = 1
      }
    })

  program
    .command('scrape')
    .description('Start TMDB scrape (poster, fanart, thumbnails, NFO) for a TV show folder')
    .argument('<folder>', 'Imported media folder path')
    .option('--language <language>', 'TMDB language code (defaults to user config preferMediaLanguage)')
    .option('--wait', 'Wait until scrape finishes and print per-task status icons')
    .action(async (folder: string, opts: { language?: string; wait?: boolean }) => {
      try {
        const core = getCore()
        const { id } = await core.scrapeFolder(folder, {
          language: opts.language,
        })
        console.log(id)
        if (!opts.wait) return

        const job = await waitUntilScrapeSettled(core, id, {
          timeoutMs: SCRAPE_WAIT_TIMEOUT_MS,
        })
        for (const line of formatScrapeJobTaskLines(job)) {
          console.log(line)
        }
        if (job.status !== 'succeeded') {
          exitCode = 1
        }
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error))
        exitCode = 1
      }
    })

  program
    .command('job')
    .description('Show job status by id (scrape: four task icon lines; import: JSON)')
    .argument('<jobId>', 'Job id from scrape or add')
    .action(async (jobId: string) => {
      try {
        const job = getCore().getJob(jobId)
        if (job === undefined) {
          console.error(`Job not found: ${jobId}`)
          exitCode = 1
          return
        }
        if (job.kind === 'scrape') {
          for (const line of formatScrapeJobTaskLines(job)) {
            console.log(line)
          }
          return
        }
        printJson(job)
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error))
        exitCode = 1
      }
    })

  const configCmd = program.command('config').description('Read or write user config (smm.json)')

  configCmd
    .command('list')
    .description('Print the full user config as JSON')
    .action(async () => {
      try {
        printJson(await getCore().getUserConfig())
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error(message)
        exitCode = 1
      }
    })

  configCmd
    .command('get')
    .description('Print one config value as JSON')
    .argument('<key>', 'Config key')
    .action(async (key: string) => {
      try {
        if (!isUserConfigKey(key)) {
          console.error(`Unknown config key: ${key}`)
          exitCode = 1
          return
        }
        const config = await getCore().getUserConfig()
        printJson(config[key] ?? null)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error(message)
        exitCode = 1
      }
    })

  configCmd
    .command('set')
    .description('Set one config key (value is JSON when parseable, otherwise a string)')
    .argument('<key>', 'Config key')
    .argument('<value>', 'Config value')
    .action(async (key: string, value: string) => {
      try {
        if (!isUserConfigKey(key)) {
          console.error(`Unknown config key: ${key}`)
          exitCode = 1
          return
        }
        const updated = await getCore().setUserConfigKey(key, parseConfigValue(value))
        printJson(updated[key] ?? null)
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
