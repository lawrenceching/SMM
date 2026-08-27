import { Command, CommanderError, Option } from 'commander'
import { mkdir, readFile } from 'node:fs/promises'
import type { FolderType, RenameRuleName } from 'core-app'
import type { MediaMetadata } from '@smm/core'
import { isUserConfigKey, NoopLoggerAdapter } from 'core-app'
import { getCore } from '../core/getCore'
import { formatHelloLines } from './helloFormat'
import { waitUntilImportSettled } from './addProgress'
import { waitUntilLibraryImportSettled } from './addlibProgress'
import { CliLoggerAdapter } from './cliLogger'
import { formatScrapeJobTaskLines } from './scrapeJobFormat'
import { waitUntilScrapeSettled } from './waitScrapeJob'
import {
  formatMediaMetadata,
  formatShowFolder,
  isFolderImported,
  resolveShowFolder,
} from './folderDisplay'
import { resolvePathUnderMediaFolder } from './resolvePathUnderMediaFolder'
import {
  classifyRenameTarget,
  printEpisodeRenameResult,
} from './renameDispatch'
import { formatTmdbSearchResults } from './tmdbSearchFormat'
import { formatTmdbDetailsTree } from './tmdbDetailsFormat'
import { formatTvdbSearchResults } from './tvdbSearchFormat'
import {
  formatPlanDetailLines,
  formatPlanListLine,
  planFileCount,
} from './planFormat'
import { Path } from '@core/path'
import { confirmRecognizeCandidate } from './recognizeConfirm'

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
 * Run the `smm` Commander program (`list`, `add`, `show`, `metadata`, `rm`, `recognize`, `try-to-recognize`, `try-to-rename`, `apply`, `reject`, `plan`, `scrape`, `rename-episode-file`, `job`, `config`, `tmdb`).
 * @param argv Full process argv (e.g. `['node', 'smm', 'list']`).
 * @returns Process exit code (0 success, 1 on error).
 */
export async function runCli(argv: string[] = process.argv): Promise<number> {
  let exitCode = 0

  const program = new Command()
  program.name('smm').exitOverride()

  program
    .command('hello')
    .description('Print application bootstrap info')
    .option('-f, --format <fmt>', 'Output format (json)')
    .action(async (opts: { format?: string }) => {
      try {
        const body = getCore().hello()
        if (opts.format === 'json') {
          printJson(body)
          return
        }
        for (const line of formatHelloLines(body)) {
          console.log(line)
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error(message)
        exitCode = 1
      }
    })

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
    .command('addlib')
    .description('Import all media folders in a library directory and wait until initialization succeeds')
    .argument('<library>', 'Library directory path')
    .addOption(
      new Option('--type <type>', 'Folder type for every subfolder (anime is an alias for tvshow)')
        .choices([...TYPE_CHOICES])
        .makeOptionMandatory(),
    )
    .option('-v, --verbose', 'Print detailed logs')
    .option('--skip-init', 'Only register subfolders in UserConfig; skip recognition and metadata')
    .action(async (library: string, opts: { type: string; verbose?: boolean; skipInit?: boolean }) => {
      try {
        const type = resolveFolderType(opts.type)
        const verbose = Boolean(opts.verbose)
        const skipInit = Boolean(opts.skipInit)
        const core = getCore({
          logger: verbose ? new CliLoggerAdapter(true) : new NoopLoggerAdapter(),
        })
        const { id } = core.importLibrary(library, type, skipInit ? { skipInit: true } : undefined)
        const job = await waitUntilLibraryImportSettled(core, id, {
          libraryPath: library,
          type,
          timeoutMs: IMPORT_WAIT_TIMEOUT_MS,
          progress: !skipInit,
          skipInit,
        })
        if (job.status !== 'succeeded') {
          console.error(job.error ?? `Import library failed with status ${job.status}`)
          exitCode = 1
          return
        }
        if (skipInit) {
          for (const task of job.tasks) {
            console.log(`imported folder ${task.path}`)
          }
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
    .command('recognize')
    .description('Recognize an imported media folder as a TMDB/TVDB TV show or movie')
    .argument('<folder>', 'Imported media folder path')
    .addOption(new Option('--db <db>', 'Media database').choices(['tmdb', 'tvdb']))
    .option('--id <id>', 'TMDB or TVDB id')
    .option('-y, --yes', 'Accept auto-recognition candidate without prompting')
    .action(async (folder: string, opts: { db?: string; id?: string; yes?: boolean }) => {
      try {
        const hasDb = opts.db !== undefined
        const hasId = opts.id !== undefined
        if (hasDb !== hasId) {
          console.error('--db and --id must be provided together')
          exitCode = 1
          return
        }
        const core = getCore()
        if (hasDb && hasId) {
          await core.recognizeFolder(folder, {
            db: opts.db as 'tmdb' | 'tvdb',
            id: opts.id!,
          })
          console.log('Metadata is updated')
          return
        }
        const candidate = await core.tryToRecognizeFolder(folder)
        const accepted = await confirmRecognizeCandidate(candidate, { yes: Boolean(opts.yes) })
        if (!accepted) {
          console.log('Cancelled')
          return
        }
        await core.recognizeFolder(folder, { db: candidate.db, id: candidate.id })
        console.log('Metadata is updated')
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error))
        exitCode = 1
      }
    })

  program
    .command('try-to-recognize')
    .description('Build a pending recognize-media-file plan for a TV show folder')
    .argument('<folder>', 'Imported media folder path')
    .action(async (folder: string) => {
      try {
        const plan = await getCore().tryToRecognizeEpisodes(folder)
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

  const applyPlanById = async (planId: string): Promise<void> => {
    try {
      const plan = await getCore().getPlan(planId)
      await getCore().applyPlan(plan)
      console.log(`applied ${plan.id} (${planFileCount(plan)} file(s))`)
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error))
      exitCode = 1
    }
  }

  const rejectPlanById = async (planId: string): Promise<void> => {
    try {
      const plan = await getCore().rejectPlan(planId)
      console.log(`rejected ${plan.id}`)
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error))
      exitCode = 1
    }
  }

  program
    .command('apply')
    .description('Apply a pending plan by id (recognize-media-file or rename-files)')
    .argument('<planId>', 'Plan id from try-to-recognize or try-to-rename')
    .action(async (planId: string) => {
      await applyPlanById(planId)
    })

  program
    .command('reject')
    .description('Reject a plan by id (keeps plan file with status rejected)')
    .argument('<planId>', 'Plan id')
    .action(async (planId: string) => {
      await rejectPlanById(planId)
    })

  const planCmd = program.command('plan').description('List, show, apply, or reject plans')

  planCmd
    .command('list')
    .description('List pending plans (optionally for a folder)')
    .argument('[folder]', 'Media folder path (omit to list all)')
    .option('-a, --all', 'Include rejected plans')
    .option('-f, --format <fmt>', 'Output format (json)')
    .action(async (folder: string | undefined, opts: { all?: boolean; format?: string }) => {
      try {
        const plans = await getCore().listPlans({
          mediaFolderPath: folder,
          all: Boolean(opts.all),
        })
        if (opts.format === 'json') {
          printJson({ plans })
          return
        }
        for (const plan of plans) {
          console.log(formatPlanListLine(plan))
        }
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error))
        exitCode = 1
      }
    })

  planCmd
    .command('show')
    .description('Show a plan by id')
    .argument('<planId>', 'Plan id')
    .option('-f, --format <fmt>', 'Output format (json)')
    .action(async (planId: string, opts: { format?: string }) => {
      try {
        const plan = await getCore().getPlan(planId)
        if (opts.format === 'json') {
          printJson({ plan })
          return
        }
        for (const line of formatPlanDetailLines(plan)) {
          console.log(line)
        }
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error))
        exitCode = 1
      }
    })

  planCmd
    .command('apply')
    .description('Apply a pending plan by id (alias of smm apply)')
    .argument('<planId>', 'Plan id')
    .action(async (planId: string) => {
      await applyPlanById(planId)
    })

  planCmd
    .command('reject')
    .description('Reject a plan by id (alias of smm reject)')
    .argument('<planId>', 'Plan id')
    .action(async (planId: string) => {
      await rejectPlanById(planId)
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
    .command('rename')
    .description(
      'Rename a managed media folder, or a linked TV episode file (+ associates)',
    )
    .argument('<from>', 'Absolute path of media folder or episode file')
    .argument('<to>', 'Absolute target path')
    .action(async (from: string, to: string) => {
      try {
        const core = getCore()
        const folders = await core.getFolders()
        const classified = await classifyRenameTarget(from, folders)
        if (classified.kind === 'folder') {
          await core.renameFolder({ from, to })
          console.log(`${Path.posix(from)} → ${Path.posix(to)}`)
          return
        }
        const result = await core.renameEpisodeFile({
          mediaFolderPath: classified.mediaFolderPath,
          from,
          to,
        })
        if (printEpisodeRenameResult(result)) {
          exitCode = 1
        }
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error))
        exitCode = 1
      }
    })

  program
    .command('rename-episode-file')
    .description(
      'Alias: rename a linked TV episode file (+ associates) under a media folder',
    )
    .argument('<folder>', 'Imported TV show media folder path')
    .requiredOption('--from <path>', 'Current episode file path (absolute or relative to folder)')
    .requiredOption('--to <path>', 'Target episode file path (absolute or relative to folder)')
    .action(async (folder: string, opts: { from: string; to: string }) => {
      try {
        const from = resolvePathUnderMediaFolder(folder, opts.from)
        const to = resolvePathUnderMediaFolder(folder, opts.to)
        const result = await getCore().renameEpisodeFile({
          mediaFolderPath: folder,
          from,
          to,
        })
        if (printEpisodeRenameResult(result)) {
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
        if (job.kind === 'import-library') {
          printJson(job)
          return
        }
        printJson(job)
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error))
        exitCode = 1
      }
    })

  const tmdbCmd = program.command('tmdb').description('TMDB helpers')

  tmdbCmd
    .command('search')
    .description('Search TMDB for TV shows or movies')
    .argument('<keyword>', 'Search keyword')
    .addOption(
      new Option('--type <type>', 'Media type')
        .choices(['tv', 'movie'])
        .makeOptionMandatory(),
    )
    .option('--host <url>', 'TMDB API base URL (overrides userConfig.tmdb.host)')
    .option('--password <key>', 'TMDB API key (overrides userConfig.tmdb.apiKey)')
    .option('--proxy <url>', 'Outbound HTTP/SOCKS proxy (overrides userConfig.tmdb.httpProxy)')
    .option(
      '--lang <language>',
      'TMDB primary translation IETF tag (static list from /configuration/primary_translations, e.g. zh-CN, en-US, fr-FR); defaults from userConfig then OS locale',
    )
    .action(
      async (
        keyword: string,
        opts: {
          type: 'tv' | 'movie'
          host?: string
          password?: string
          proxy?: string
          lang?: string
        },
      ) => {
        try {
          const body = await getCore().searchInTmdb(keyword, {
            type: opts.type,
            host: opts.host,
            password: opts.password,
            proxy: opts.proxy,
            language: opts.lang,
          })
          if (body.error) {
            console.error(body.error)
            exitCode = 1
            return
          }
          const text = formatTmdbSearchResults(body, opts.type)
          if (text) console.log(text)
        } catch (error) {
          console.error(error instanceof Error ? error.message : String(error))
          exitCode = 1
        }
      },
    )

  function registerTmdbGetCommand(
    name: 'tv' | 'movie',
    description: string,
    fetch: (
      id: number,
      options: {
        language?: string
        host?: string
        password?: string
        proxy?: string
      },
    ) => Promise<unknown>,
  ) {
    tmdbCmd
      .command(name)
      .description(description)
      .argument('<tmdbid>', 'TMDB id')
      .addOption(
        new Option('-f, --format <fmt>', 'Output format')
          .choices(['json', 'default'])
          .default('default'),
      )
      .option('--host <url>', 'TMDB API base URL (overrides userConfig.tmdb.host)')
      .option('--password <key>', 'TMDB API key (overrides userConfig.tmdb.apiKey)')
      .option('--proxy <url>', 'Outbound HTTP/SOCKS proxy (overrides userConfig.tmdb.httpProxy)')
      .option(
        '--lang <language>',
        'TMDB primary translation IETF tag (static list from /configuration/primary_translations, e.g. zh-CN, en-US, fr-FR); defaults from userConfig then OS locale',
      )
      .action(
        async (
          tmdbIdRaw: string,
          opts: {
            format?: string
            host?: string
            password?: string
            proxy?: string
            lang?: string
          },
        ) => {
          try {
            const id = Number(tmdbIdRaw)
            if (!Number.isInteger(id) || id <= 0) {
              console.error('id must be a positive integer')
              exitCode = 1
              return
            }
            const details = await fetch(id, {
              language: opts.lang,
              host: opts.host,
              password: opts.password,
              proxy: opts.proxy,
            })
            if (opts.format === 'json') {
              printJson(details)
              return
            }
            console.log(formatTmdbDetailsTree(details))
          } catch (error) {
            console.error(error instanceof Error ? error.message : String(error))
            exitCode = 1
          }
        },
      )
  }

  registerTmdbGetCommand('tv', 'Get TMDB TV show details by id', (id, options) =>
    getCore().getTvShowInTmdb(id, options),
  )
  registerTmdbGetCommand('movie', 'Get TMDB movie details by id', (id, options) =>
    getCore().getMovieInTmdb(id, options),
  )

  const tvdbCmd = program.command('tvdb').description('TVDB helpers')

  tvdbCmd
    .command('search')
    .description('Search TVDB for TV series or movies')
    .argument('<keyword>', 'Search keyword')
    .addOption(
      new Option('--type <type>', 'Media type')
        .choices(['series', 'movie'])
        .makeOptionMandatory(),
    )
    .option('--host <url>', 'TVDB API base URL (overrides userConfig.tvdb.host)')
    .option('--password <key>', 'TVDB API key (overrides userConfig.tvdb.apiKey)')
    .option('--proxy <url>', 'Outbound HTTP/SOCKS proxy (overrides userConfig.tvdb.httpProxy)')
    .option(
      '--lang <language>',
      'TVDB ISO 639-3 language code (static list, e.g. eng, zho, yue); defaults from userConfig then OS locale',
    )
    .action(
      async (
        keyword: string,
        opts: {
          type: 'series' | 'movie'
          host?: string
          password?: string
          proxy?: string
          lang?: string
        },
      ) => {
        try {
          const results = await getCore().searchInTvdb(keyword, {
            type: opts.type,
            host: opts.host,
            password: opts.password,
            proxy: opts.proxy,
            language: opts.lang,
          })
          const text = formatTvdbSearchResults(results, opts.type)
          if (text) console.log(text)
        } catch (error) {
          console.error(error instanceof Error ? error.message : String(error))
          exitCode = 1
        }
      },
    )

  function registerTvdbGetCommand(
    name: 'tv' | 'movie',
    description: string,
    fetch: (
      id: number,
      options: {
        language?: string
        host?: string
        password?: string
        proxy?: string
      },
    ) => Promise<unknown>,
  ) {
    tvdbCmd
      .command(name)
      .description(description)
      .argument('<tvdbid>', 'TVDB id')
      .addOption(
        new Option('-f, --format <fmt>', 'Output format')
          .choices(['json', 'default'])
          .default('default'),
      )
      .option('--host <url>', 'TVDB API base URL (overrides userConfig.tvdb.host)')
      .option('--password <key>', 'TVDB API key (overrides userConfig.tvdb.apiKey)')
      .option('--proxy <url>', 'Outbound HTTP/SOCKS proxy (overrides userConfig.tvdb.httpProxy)')
      .option(
        '--lang <language>',
        'TVDB ISO 639-3 language code (static list, e.g. eng, zho, yue); defaults from userConfig then OS locale',
      )
      .action(
        async (
          tvdbIdRaw: string,
          opts: {
            format?: string
            host?: string
            password?: string
            proxy?: string
            lang?: string
          },
        ) => {
          try {
            const id = Number(tvdbIdRaw)
            if (!Number.isInteger(id) || id <= 0) {
              console.error('id must be a positive integer')
              exitCode = 1
              return
            }
            const details = await fetch(id, {
              language: opts.lang,
              host: opts.host,
              password: opts.password,
              proxy: opts.proxy,
            })
            if (opts.format === 'json') {
              printJson(details)
              return
            }
            console.log(formatTmdbDetailsTree(details))
          } catch (error) {
            console.error(error instanceof Error ? error.message : String(error))
            exitCode = 1
          }
        },
      )
  }

  registerTvdbGetCommand('tv', 'Get TVDB series details by id (raw API)', (id, options) =>
    getCore().getTvdbSeriesById(id, options),
  )
  registerTvdbGetCommand('movie', 'Get TVDB movie details by id (raw API)', (id, options) =>
    getCore().getTvdbMovieById(id, options),
  )

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

  const mcpCmd = program.command('mcp').description('MCP server management')

  mcpCmd
    .command('start')
    .description('Start the MCP server and keep running until interrupted')
    .option('--host <host>', 'MCP server bind host (default: user config mcpHost or 127.0.0.1)')
    .option('-p, --port <port>', 'MCP server port (default: user config mcpPort or 30001)')
    .action(async (opts: { host?: string; port?: string }) => {
      // Lazy imports: pulling in the MCP lifecycle manager (and thus
      // `@smm/core-routes`) at module load breaks vitest's CLI unit tests
      // which don't alias `@smm/core/path`.
      const { getAppDataDir, getLogDir, getUserDataDir } = await import('@/utils/config')

      await mkdir(getUserDataDir(), { recursive: true })
      await mkdir(getAppDataDir(), { recursive: true })
      await mkdir(getLogDir(), { recursive: true })

      const core = getCore()
      const state = await core.startMcpServer(
        {
          hostname: opts.host,
          port: opts.port ? Number(opts.port) : undefined,
        },
        { persistUserConfig: true },
      )
      if (state.status !== 'running' || !state.url) {
        throw new Error(state.error ?? 'MCP server failed to start')
      }
      console.log(
        `MCP server started at ${state.url} using protocol is Streamable HTTP`,
      )

      // Keep the process alive until interrupted, then stop the server gracefully.
      await new Promise<void>((resolve) => {
        let stopping = false
        const shutdown = async () => {
          if (stopping) {
            return
          }
          stopping = true
          try {
            await core.stopMcpServer({ persistUserConfig: true })
          } finally {
            resolve()
          }
        }
        const onSignal = () => {
          void shutdown()
        }
        process.once('SIGINT', onSignal)
        process.once('SIGTERM', onSignal)
        if (process.platform === 'win32') {
          process.once('SIGBREAK', onSignal)
        }
      })
    })

  try {
    await program.parseAsync(argv, { from: 'node' })
  } catch (error) {
    // exitOverride(): help/version throw after writing to stdout with exitCode 0.
    if (error instanceof CommanderError) {
      if (error.exitCode !== 0) {
        console.error(error.message)
      }
      return error.exitCode
    }
    const message = error instanceof Error ? error.message : String(error)
    console.error(message)
    exitCode = 1
  }

  return exitCode
}
