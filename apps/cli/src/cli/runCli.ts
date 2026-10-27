import { Command, CommanderError, Option } from 'commander'
import type { FolderType } from '@smm/core'
import { add } from './commands/add'
import { addlib } from './commands/addlib'
import { download } from './commands/download'
import { hello } from './commands/hello'
import { processSubtitle } from './commands/processSubtitle'
import { synthesize } from './commands/synthesize'
import { convert } from './commands/convert'
import { compress } from './commands/compress'
import { transcribe } from './commands/transcribe'
import { translate } from './commands/translate'
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
import { jobList } from './commands/jobList'
import { jobLog } from './commands/jobLog'
import { jobShow } from './commands/jobShow'
import { jobStop } from './commands/jobStop'
import { tmdbMovie } from './commands/tmdbMovie'
import { tmdbSearch } from './commands/tmdbSearch'
import { tmdbTv } from './commands/tmdbTv'
import { tvdbMovie } from './commands/tvdbMovie'
import { tvdbSearch } from './commands/tvdbSearch'
import { tvdbTv } from './commands/tvdbTv'
import { configList } from './commands/configList'
import { configGet } from './commands/configGet'
import { configSet } from './commands/configSet'
import { mcpStart } from './commands/mcpStart'
import { startWeb } from '../web/startWeb'

const FOLDER_TYPES: readonly FolderType[] = ['tvshow', 'movie', 'music']
const TYPE_CHOICES = [...FOLDER_TYPES, 'anime'] as const

/**
 * Run the `smm` Commander program (`list`, `add`, `show`, `metadata`, `rm`, `recognize`, `try-to-recognize`, `try-to-rename`, `apply`, `reject`, `plan`, `scrape`, `convert`, `compress`, `rename-episode-file`, `job`, `config`, `tmdb`, `tvdb`, `mcp`, `web`).
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
    .command('download')
    .description('Download a video with yt-dlp into a folder')
    .argument('<url>', 'Video URL')
    .requiredOption('--folder <path>', 'Destination folder')
    .option('--format <format>', 'Format preset (default|best|1080p|720p|audio) or raw -f code', 'default')
    .option('--proxy <url>', 'Proxy URL for yt-dlp --proxy')
    .option('--cookies-from-browser <name>', 'Browser name for --cookies-from-browser')
    .option('--cookies <file>', 'Netscape cookies file path')
    .option('--title <title>', 'Display title for the job')
    .option('--sub-langs <codes>', 'Comma-separated subtitle languages, for example en,zh-Hans')
    .option(
      '--print-progress-only',
      'Print only progress snapshot lines (progress percent=…); omit yt-dlp logs',
    )
    .option('-v, --verbose', 'Print detailed logs')
    .action(
      async (
        url: string,
        opts: {
          folder: string
          format?: string
          proxy?: string
          cookiesFromBrowser?: string
          cookies?: string
          title?: string
          subLangs?: string
          verbose?: boolean
          printProgressOnly?: boolean
        },
      ) => {
        exitCode = await download(url, opts)
      },
    )

  program
    .command('transcribe')
    .description('Transcribe a media file to a subtitle with videocaptioner')
    .argument('<media>', 'Media file path')
    .requiredOption('--folder <path>', 'Media folder path')
    .addOption(
      new Option('--asr <engine>', 'ASR engine')
        .choices(['bijian', 'jianying', 'whisper-cpp'])
        .default('bijian'),
    )
    .option('--language <lang>', 'Source language hint for ASR')
    .addOption(
      new Option('--format <fmt>', 'Subtitle output format')
        .choices(['srt', 'ass', 'txt', 'json'])
        .default('srt'),
    )
    .option('--word-timestamps', 'Request word-level timestamps')
    .option('--title <title>', 'Display title for the job')
    .option('-v, --verbose', 'Print detailed logs')
    .action(
      async (
        media: string,
        opts: {
          folder: string
          asr?: 'bijian' | 'jianying' | 'whisper-cpp'
          language?: string
          format?: 'srt' | 'ass' | 'txt' | 'json'
          wordTimestamps?: boolean
          title?: string
          verbose?: boolean
        },
      ) => {
        exitCode = await transcribe(media, opts)
      },
    )

  program
    .command('translate')
    .description('Translate a subtitle file with videocaptioner')
    .argument('<subtitle>', 'Subtitle file path')
    .requiredOption('--folder <path>', 'Media folder path')
    .addOption(
      new Option('--translator <name>', 'Translator backend')
        .choices(['bing', 'google', 'llm'])
        .makeOptionMandatory(),
    )
    .requiredOption('--target-language <lang>', 'Target language code')
    .option('--reflect', 'Enable reflect pass for translation')
    .addOption(
      new Option('--layout <layout>', 'Bilingual subtitle layout').choices([
        'target-above',
        'source-above',
        'target-only',
        'source-only',
      ]),
    )
    .option('--api-key <key>', 'LLM API key (required when --translator llm)')
    .option('--api-base <url>', 'LLM API base URL')
    .option('--model <name>', 'LLM model name')
    .option('--title <title>', 'Display title for the job')
    .option('--media <path>', 'Associated media file path')
    .option('-v, --verbose', 'Print detailed logs')
    .action(
      async (
        subtitle: string,
        opts: {
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
        },
      ) => {
        exitCode = await translate(subtitle, opts)
      },
    )

  program
    .command('synthesize')
    .description('Burn or soft-mux subtitles onto a video with videocaptioner')
    .argument('<video>', 'Video file path')
    .requiredOption('-s, --subtitle <path>', 'Subtitle file path')
    .requiredOption('--folder <path>', 'Media folder path')
    .addOption(
      new Option('--subtitle-mode <mode>', 'Subtitle mux mode').choices(['soft', 'hard']),
    )
    .addOption(
      new Option('--quality <quality>', 'Output quality preset').choices([
        'ultra',
        'high',
        'medium',
        'low',
      ]),
    )
    .option('--style <style>', 'Subtitle style')
    .addOption(
      new Option('--render-mode <mode>', 'Hard-sub render mode').choices(['ass', 'rounded']),
    )
    .addOption(
      new Option('--layout <layout>', 'Bilingual subtitle layout').choices([
        'target-above',
        'source-above',
        'target-only',
        'source-only',
      ]),
    )
    .option('--title <title>', 'Display title for the job')
    .option('-v, --verbose', 'Print detailed logs')
    .action(
      async (
        video: string,
        opts: {
          folder: string
          subtitle: string
          subtitleMode?: 'soft' | 'hard'
          quality?: 'ultra' | 'high' | 'medium' | 'low'
          style?: string
          renderMode?: 'ass' | 'rounded'
          layout?: 'target-above' | 'source-above' | 'target-only' | 'source-only'
          title?: string
          verbose?: boolean
        },
      ) => {
        exitCode = await synthesize(video, opts)
      },
    )

  program
    .command('convert')
    .description('Convert a video file with ffmpeg')
    .argument('<input>', 'Input video (or image) file path')
    .requiredOption('-o, --output <path>', 'Output file path')
    .requiredOption('--folder <path>', 'Media folder path')
    .addOption(
      new Option('--format <fmt>', 'Output format')
        .choices(['mp4h264', 'mp4h265', 'webm', 'mkv', 'avif', 'webp', 'apng'])
        .makeOptionMandatory(),
    )
    .addOption(
      new Option('--preset <preset>', 'Encode preset')
        .choices(['quality', 'balanced', 'speed'])
        .makeOptionMandatory(),
    )
    .option('--title <title>', 'Display title for the job')
    .option('-v, --verbose', 'Print detailed logs')
    .action(
      async (
        input: string,
        opts: {
          output: string
          folder: string
          format: 'mp4h264' | 'mp4h265' | 'webm' | 'mkv' | 'avif' | 'webp' | 'apng'
          preset: 'quality' | 'balanced' | 'speed'
          title?: string
          verbose?: boolean
        },
      ) => {
        exitCode = await convert(input, opts)
      },
    )

  program
    .command('compress')
    .description(
      'Compress a video with ffmpeg (v1 flags: --container plus optional --preset-key, --crf, --video-encoder, --two-pass)',
    )
    .argument('<input>', 'Input video file path')
    .requiredOption('-o, --output <path>', 'Output file path')
    .requiredOption('--folder <path>', 'Media folder path')
    .addOption(
      new Option('--container <container>', 'Output container')
        .choices(['mp4', 'mkv', 'webm', 'mov'])
        .makeOptionMandatory(),
    )
    .addOption(
      new Option('--preset-key <key>', 'Compress preset key (overrides default balanced)').choices([
        'speed',
        'balanced',
        'quality',
        'extreme',
        'audioOnly',
        'custom',
      ]),
    )
    .option('--crf <n>', 'CRF quality value (overrides default)', (v: string) => parseInt(v, 10))
    .option('--video-encoder <name>', 'Video encoder id (e.g. libx264, libx265)')
    .option('--two-pass', 'Enable two-pass encoding')
    .option('--title <title>', 'Display title for the job')
    .option('-v, --verbose', 'Print detailed logs')
    .action(
      async (
        input: string,
        opts: {
          output: string
          folder: string
          container: 'mp4' | 'mkv' | 'webm' | 'mov'
          presetKey?: 'speed' | 'balanced' | 'quality' | 'extreme' | 'audioOnly' | 'custom'
          crf?: number
          videoEncoder?: string
          twoPass?: boolean
          title?: string
          verbose?: boolean
        },
      ) => {
        exitCode = await compress(input, opts)
      },
    )

  program
    .command('process')
    .description('Run the full subtitle pipeline (transcribe → translate → synthesize)')
    .argument('<media>', 'Media file path')
    .requiredOption('--folder <path>', 'Media folder path')
    .addOption(
      new Option('--asr <engine>', 'ASR engine').choices(['bijian', 'jianying', 'whisper-cpp']),
    )
    .option('--language <lang>', 'Source language hint for ASR')
    .addOption(
      new Option('--format <fmt>', 'Subtitle output format').choices([
        'srt',
        'ass',
        'txt',
        'json',
      ]),
    )
    .option('--word-timestamps', 'Request word-level timestamps')
    // Commander treats --no-* as negate options (property = optimize/split/translate/synthesize).
    .option('--no-optimize', 'Skip subtitle optimization')
    .option('--no-split', 'Skip subtitle splitting')
    .option('--no-translate', 'Skip translation')
    .addOption(
      new Option('--translator <name>', 'Translator backend').choices(['bing', 'google', 'llm']),
    )
    .option('--target-language <lang>', 'Target language code')
    .option('--reflect', 'Enable reflect pass for translation')
    .addOption(
      new Option('--layout <layout>', 'Bilingual subtitle layout').choices([
        'target-above',
        'source-above',
        'target-only',
        'source-only',
      ]),
    )
    .option('--prompt <text>', 'Custom translation prompt')
    .option('--api-key <key>', 'LLM API key (required when --translator llm)')
    .option('--api-base <url>', 'LLM API base URL')
    .option('--model <name>', 'LLM model name')
    .option('--no-synthesize', 'Skip synthesize step')
    .addOption(
      new Option('--subtitle-mode <mode>', 'Subtitle mux mode').choices(['soft', 'hard']),
    )
    .addOption(
      new Option('--quality <quality>', 'Synthesize quality preset').choices([
        'ultra',
        'high',
        'medium',
        'low',
      ]),
    )
    .option('--style <style>', 'Synthesize subtitle style')
    .addOption(
      new Option('--render-mode <mode>', 'Hard-sub render mode').choices(['ass', 'rounded']),
    )
    .addOption(
      new Option('--synthesize-layout <layout>', 'Synthesize bilingual layout').choices([
        'target-above',
        'source-above',
        'target-only',
        'source-only',
      ]),
    )
    .option('--title <title>', 'Display title for the job')
    .option('-v, --verbose', 'Print detailed logs')
    .action(
      async (
        media: string,
        opts: {
          folder: string
          asr?: 'bijian' | 'jianying' | 'whisper-cpp'
          language?: string
          format?: 'srt' | 'ass' | 'txt' | 'json'
          wordTimestamps?: boolean
          /** Commander --no-optimize → optimize=false when passed. */
          optimize?: boolean
          split?: boolean
          translate?: boolean
          synthesize?: boolean
          translator?: 'bing' | 'google' | 'llm'
          targetLanguage?: string
          reflect?: boolean
          layout?: 'target-above' | 'source-above' | 'target-only' | 'source-only'
          prompt?: string
          apiKey?: string
          apiBase?: string
          model?: string
          subtitleMode?: 'soft' | 'hard'
          quality?: 'ultra' | 'high' | 'medium' | 'low'
          style?: string
          renderMode?: 'ass' | 'rounded'
          synthesizeLayout?: 'target-above' | 'source-above' | 'target-only' | 'source-only'
          title?: string
          verbose?: boolean
        },
      ) => {
        exitCode = await processSubtitle(media, {
          folder: opts.folder,
          asr: opts.asr,
          language: opts.language,
          format: opts.format,
          wordTimestamps: opts.wordTimestamps,
          noOptimize: opts.optimize === false ? true : undefined,
          noSplit: opts.split === false ? true : undefined,
          noTranslate: opts.translate === false ? true : undefined,
          translator: opts.translator,
          targetLanguage: opts.targetLanguage,
          reflect: opts.reflect,
          layout: opts.layout,
          prompt: opts.prompt,
          apiKey: opts.apiKey,
          apiBase: opts.apiBase,
          model: opts.model,
          noSynthesize: opts.synthesize === false ? true : undefined,
          subtitleMode: opts.subtitleMode,
          quality: opts.quality,
          style: opts.style,
          renderMode: opts.renderMode,
          synthesizeLayout: opts.synthesizeLayout,
          title: opts.title,
          verbose: opts.verbose,
        })
      },
    )

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
      exitCode = await jobList()
    })

  jobCmd
    .command('log')
    .description('Print job log messages')
    .argument('<jobId>', 'Job id')
    .action(async (jobId: string) => {
      exitCode = await jobLog(jobId)
    })

  jobCmd
    .command('stop')
    .description('Abort a running import job')
    .argument('<jobId>', 'Job id')
    .action(async (jobId: string) => {
      exitCode = await jobStop(jobId)
    })

  jobCmd
    .argument('<jobId>', 'Job id from scrape or add')
    .action(async (jobId: string) => {
      exitCode = await jobShow(jobId)
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
    .action(async (keyword: string, opts: { type: 'tv' | 'movie'; host?: string; password?: string; proxy?: string; lang?: string }) => {
      exitCode = await tmdbSearch(keyword, opts)
    })

  tmdbCmd
    .command('tv')
    .description('Get TMDB TV show details by id')
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
    .action(async (tmdbIdRaw: string, opts: { format?: string; host?: string; password?: string; proxy?: string; lang?: string }) => {
      exitCode = await tmdbTv(tmdbIdRaw, opts)
    })

  tmdbCmd
    .command('movie')
    .description('Get TMDB movie details by id')
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
    .action(async (tmdbIdRaw: string, opts: { format?: string; host?: string; password?: string; proxy?: string; lang?: string }) => {
      exitCode = await tmdbMovie(tmdbIdRaw, opts)
    })

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
    .action(async (keyword: string, opts: { type: 'series' | 'movie'; host?: string; password?: string; proxy?: string; lang?: string }) => {
      exitCode = await tvdbSearch(keyword, opts)
    })

  tvdbCmd
    .command('tv')
    .description('Get TVDB series details by id (raw API)')
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
    .action(async (tvdbIdRaw: string, opts: { format?: string; host?: string; password?: string; proxy?: string; lang?: string }) => {
      exitCode = await tvdbTv(tvdbIdRaw, opts)
    })

  tvdbCmd
    .command('movie')
    .description('Get TVDB movie details by id (raw API)')
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
    .action(async (tvdbIdRaw: string, opts: { format?: string; host?: string; password?: string; proxy?: string; lang?: string }) => {
      exitCode = await tvdbMovie(tvdbIdRaw, opts)
    })

  const configCmd = program.command('config').description('Read or write user config (smm.json)')

  configCmd
    .command('list')
    .description('Print the full user config as JSON')
    .action(async () => {
      exitCode = await configList()
    })

  configCmd
    .command('get')
    .description('Print one config value as JSON')
    .argument('<key>', 'Config key')
    .action(async (key: string) => {
      exitCode = await configGet(key)
    })

  configCmd
    .command('set')
    .description('Set one config key (value is JSON when parseable, otherwise a string)')
    .argument('<key>', 'Config key')
    .argument('<value>', 'Config value')
    .action(async (key: string, value: string) => {
      exitCode = await configSet(key, value)
    })

  const mcpCmd = program.command('mcp').description('MCP server management')

  mcpCmd
    .command('start')
    .description('Start the MCP server and keep running until interrupted')
    .option('--host <host>', 'MCP server bind host (default: user config mcpHost or 127.0.0.1)')
    .option('-p, --port <port>', 'MCP server port (default: user config mcpPort or 30001)')
    .action(async (opts: { host?: string; port?: string }) => {
      exitCode = await mcpStart(opts)
    })

  program
    .command('web')
    .description('Start the SMM HTTP server (Web UI + API)')
    .option('--staticDir <dir>', 'Static Web UI directory (default: ../ui/dist)')
    .option('--port <port>', 'HTTP port (default: HTTP_PORT env or 30000)')
    .action(async (opts: { staticDir?: string; port?: string }) => {
      await startWeb({
        staticDir: opts.staticDir,
        port: opts.port ? parseInt(opts.port, 10) : undefined,
      })
      // Keep the process alive for the HTTP server; exit handled by signals.
      await new Promise(() => {})
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
