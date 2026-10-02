import { Command, CommanderError, Option } from 'commander'
import { mkdir } from 'node:fs/promises'
import type { FolderType } from '@smm/core'
import { isUserConfigKey, NoopLoggerAdapter, ScrapeJob } from '@smm/core'
import { getCore } from '../core/getCore'
import { createAddProgressState, emitAddProgress } from './addProgress'
import { CliLoggerAdapter } from './cliLogger'
import { formatScrapeJobTaskLines } from './scrapeJobFormat'
import { formatTmdbSearchResults } from './tmdbSearchFormat'
import { formatTmdbDetailsTree } from './tmdbDetailsFormat'
import { formatTvdbSearchResults } from './tvdbSearchFormat'
import { getLogDir } from '../utils/config'
import {
  listPersistedImportJobIds,
  persistedJobLogLines,
  readPersistedJobLog,
} from './persistedJobLog'
import { add } from './commands/add'
import { addlib } from './commands/addlib'
import { hello } from './commands/hello'
import { list } from './commands/list'
import { metadata } from './commands/metadata'
import { recognize } from './commands/recognize'
import { rm } from './commands/rm'
import { scrape } from './commands/scrape'
import { show } from './commands/show'
import { tryToRecognize } from './commands/tryToRecognize'
import { tryToRename } from './commands/tryToRename'
import { apply } from './commands/apply'
import { reject } from './commands/reject'
import { planApply } from './commands/planApply'
import { planList } from './commands/planList'
import { planReject } from './commands/planReject'
import { planShow } from './commands/planShow'
import { rename } from './commands/rename'
import { renameEpisodeFile } from './commands/renameEpisodeFile'
import { parseConfigValue, printJson } from './commands/shared'
const FOLDER_TYPES: readonly FolderType[] = ['tvshow', 'movie', 'music']
const TYPE_CHOICES = [...FOLDER_TYPES, 'anime'] as const

const IMPORT_WAIT_TIMEOUT_MS = 5 * 60 * 1000

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
      exitCode = await hello(opts)
    })

  program
    .command('list')
    .description('List imported media folder paths')
    .action(async () => {
      exitCode = await list()
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
    // TODO:
    .option('--skip-init', 'Only register the folder in UserConfig; skip recognition and metadata')
    .action(async (folder: string, opts: { type: string; verbose?: boolean; skipInit?: boolean }) => {
      exitCode = await add(folder, opts)
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
      exitCode = await addlib(library, opts)
    })

  program
    .command('show')
    .description('Show imported folder status (UI-aligned)')
    .argument('<folder>', 'Folder path')
    .action(async (folder: string) => {
      exitCode = await show(folder)
    })

  program
    .command('metadata')
    .description('Show or write media metadata for an imported folder')
    .argument('<folder>', 'Folder path')
    .option('--set <file>', 'Write media metadata from a JSON file')
    .action(async (folder: string, opts: { set?: string }) => {
      exitCode = await metadata(folder, opts)
    })

  program
    .command('rm')
    .description('Unimport a media folder (remove from config and delete metadata cache)')
    .argument('<folder>', 'Folder path to unimport')
    .action(async (folder: string) => {
      exitCode = await rm(folder)
    })

  program
    .command('recognize')
    .description('Recognize an imported media folder as a TMDB/TVDB TV show or movie')
    .argument('<folder>', 'Imported media folder path')
    .addOption(new Option('--db <db>', 'Media database').choices(['tmdb', 'tvdb']))
    .option('--id <id>', 'TMDB or TVDB id')
    .option('-y, --yes', 'Accept auto-recognition candidate without prompting')
    .action(async (folder: string, opts: { db?: string; id?: string; yes?: boolean }) => {
      exitCode = await recognize(folder, opts)
    })

  program
    .command('try-to-recognize')
    .description('Build a pending recognize-media-file plan for a TV show folder')
    .argument('<folder>', 'Imported media folder path')
    .action(async (folder: string) => {
      exitCode = await tryToRecognize(folder)
    })

  program
    .command('try-to-rename')
    .description('Build a pending rename-files plan (plex/emby)')
    .argument('<folder>', 'Imported media folder path')
    .option('--rule <rule>', 'Naming rule: plex | emby', 'plex')
    .action(async (folder: string, opts: { rule: string }) => {
      exitCode = await tryToRename(folder, opts)
    })

  program
    .command('apply')
    .description('Apply a pending plan by id (recognize-media-file or rename-files)')
    .argument('<planId>', 'Plan id from try-to-recognize or try-to-rename')
    .action(async (planId: string) => {
      exitCode = await apply(planId)
    })

  program
    .command('reject')
    .description('Reject a plan by id (keeps plan file with status rejected)')
    .argument('<planId>', 'Plan id')
    .action(async (planId: string) => {
      exitCode = await reject(planId)
    })

  const planCmd = program.command('plan').description('List, show, apply, or reject plans')

  planCmd
    .command('list')
    .description('List pending plans (optionally for a folder)')
    .argument('[folder]', 'Media folder path (omit to list all)')
    .option('-a, --all', 'Include rejected plans')
    .option('-f, --format <fmt>', 'Output format (json)')
    .action(async (folder: string | undefined, opts: { all?: boolean; format?: string }) => {
      exitCode = await planList(folder, opts)
    })

  planCmd
    .command('show')
    .description('Show a plan by id')
    .argument('<planId>', 'Plan id')
    .option('-f, --format <fmt>', 'Output format (json)')
    .action(async (planId: string, opts: { format?: string }) => {
      exitCode = await planShow(planId, opts)
    })

  planCmd
    .command('apply')
    .description('Apply a pending plan by id (alias of smm apply)')
    .argument('<planId>', 'Plan id')
    .action(async (planId: string) => {
      exitCode = await planApply(planId)
    })

  planCmd
    .command('reject')
    .description('Reject a plan by id (alias of smm reject)')
    .argument('<planId>', 'Plan id')
    .action(async (planId: string) => {
      exitCode = await planReject(planId)
    })

  program
    .command('scrape')
    .description('Start TMDB scrape (poster, fanart, thumbnails, NFO) for a TV show folder')
    .argument('<folder>', 'Imported media folder path')
    .option('--language <language>', 'TMDB language code (defaults to user config preferMediaLanguage)')
    .option('--wait', 'Wait until scrape finishes and print per-task status icons')
    .option('-v, --verbose', 'Print detailed logs')
    .action(async (folder: string, opts: { language?: string; wait?: boolean; verbose?: boolean }) => {
      exitCode = await scrape(folder, opts)
    })

  program
    .command('rename')
    .description(
      'Rename a managed media folder, or a linked TV episode file (+ associates)',
    )
    .argument('<from>', 'Absolute path of media folder or episode file')
    .argument('<to>', 'Absolute target path')
    .action(async (from: string, to: string) => {
      exitCode = await rename(from, to)
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
      exitCode = await renameEpisodeFile(folder, opts)
    })

  const jobCmd = program.command('job').description('Show job status, print log, or stop a job')

  jobCmd
    .command('list')
    .description('List import jobs that have a log file')
    .action(async () => {
      try {
        const ids = await listPersistedImportJobIds(getLogDir())
        for (const id of ids) {
          console.log(id)
        }
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error))
        exitCode = 1
      }
    })

  jobCmd
    .command('log')
    .description('Print job log messages')
    .argument('<jobId>', 'Job id')
    .action(async (jobId: string) => {
      try {
        let messages: string[] | undefined
        try {
          messages = getCore().getJobLog(jobId).map((line) => line.message)
        } catch (error) {
          if (!(error instanceof Error) || error.message !== 'Job not found') throw error
        }
        if (messages === undefined) {
          const text = await readPersistedJobLog(jobId)
          if (text === null) {
            console.error(`Job not found: ${jobId}`)
            exitCode = 1
            return
          }
          messages = persistedJobLogLines(text)
        }
        for (const message of messages) {
          console.log(message)
        }
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error))
        exitCode = 1
      }
    })

  jobCmd
    .command('stop')
    .description('Abort a running import job')
    .argument('<jobId>', 'Job id')
    .action(async (jobId: string) => {
      try {
        getCore().stopJob(jobId)
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error))
        exitCode = 1
      }
    })

  jobCmd
    .argument('<jobId>', 'Job id from scrape or add')
    .action(async (jobId: string) => {
      try {
        const job = getCore().getJob(jobId)
        if (job === undefined) {
          console.error(`Job not found: ${jobId}`)
          exitCode = 1
          return
        }
        if (job instanceof ScrapeJob) {
          for (const line of formatScrapeJobTaskLines(job)) {
            console.log(line)
          }
          return
        }
        if (job.type === 'import-library') {
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
      // which don't alias `@smm/utils/path`.
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
