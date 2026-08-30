import type { UserConfig } from "@smm/types";
import { resolveAppLanguage, detectOsLocale } from "@smm/utils/locale";
import { GET_APPLICATION_CONTEXT } from "@smm/types/ai-tools/getApplicationContext";
import { IS_FOLDER_EXIST } from "@smm/types/ai-tools/isFolderExist";
import { GET_MEDIA_METADATA } from "@smm/types/ai-tools/getMediaMetadata";
import { GET_EPISODES } from "@smm/types/ai-tools/getEpisodes";
import { GET_MEDIA_FOLDERS } from "@smm/types/ai-tools/getMediaFolders";
import { LIST_FILES_IN_MEDIA_FOLDER } from "@smm/types/ai-tools/listFilesInMediaFolder";
import { RENAME_FOLDER } from "@smm/types/ai-tools/renameFolder";
import { RENAME_EPISODE_FILE } from "@smm/types/ai-tools/renameEpisodeFile";
import { SCRAPE } from "@smm/types/ai-tools/scrape";
import { GET_JOB } from "@smm/types/ai-tools/getJob";
import { TMDB_SEARCH } from "@smm/types/ai-tools/tmdbSearch";
import { TMDB_GET_MOVIE } from "@smm/types/ai-tools/tmdbGetMovie";
import { TMDB_GET_TV_SHOW } from "@smm/types/ai-tools/tmdbGetTvShow";
import {
  buildTmdbGetMovieTool,
  buildTmdbGetTvShowTool,
  buildTmdbSearchTool,
  type TmdbToolRunners,
} from "./tmdb.ts";
import { TVDB_SEARCH } from "@smm/types/ai-tools/tvdbSearch";
import { TVDB_GET_MOVIE } from "@smm/types/ai-tools/tvdbGetMovie";
import { TVDB_GET_TV_SHOW } from "@smm/types/ai-tools/tvdbGetTvShow";
import { TVDB_GET_LANGUAGES } from "@smm/types/ai-tools/tvdbGetLanguages";
import {
  buildTvdbGetLanguagesTool,
  buildTvdbGetMovieTool,
  buildTvdbGetTvShowTool,
  buildTvdbSearchTool,
  type TvdbToolRunners,
} from "./tvdb.ts";
import {
  CREATE_RENAME_EPISODE_PLAN,
} from "@smm/types/ai-tools/createRenameEpisodePlan";
import {
  BEGIN_RECOGNIZE_TASK,
  ADD_RECOGNIZED_MEDIA_FILE,
  END_RECOGNIZE_TASK,
} from "@smm/types/ai-tools/recognizeMediaFileTask";
import type { CoreRoutesConfig } from "../types.ts";
import { defaultChatFs } from "../chatFs.ts";
import type { ChatConfig, ChatFs } from "../chatTypes.ts";
import { defaultAcknowledge } from "./acknowledge.ts";
import { defaultBroadcast } from "./broadcast.ts";
import { buildGetApplicationContextTool } from "./getApplicationContext.ts";
import { buildIsFolderExistTool } from "./isFolderExist.ts";
import { buildGetMediaMetadataTool } from "./getMediaMetadata.ts";
import { buildGetEpisodesTool } from "./getEpisodes.ts";
import { buildGetMediaFoldersTool } from "./getMediaFolders.ts";
import { buildListFilesInMediaFolderTool } from "./listFilesInMediaFolder.ts";
import { buildRenameFolderTool } from "./renameFolder.ts";
import {
  buildRenameEpisodeFileTool,
  type RenameEpisodeFileRunner,
} from "./renameEpisodeFile.ts";
import {
  buildScrapeTool,
  type ScrapeFolderRunner,
} from "./scrape.ts";
import {
  buildGetJobTool,
  type GetJobRunner,
} from "./getJob.ts";
import { buildCreateRenameEpisodePlanTool } from "./createRenameEpisodePlan.ts";
import {
  buildAddRecognizedMediaFileTool,
  buildBeginRecognizeTaskTool,
  buildEndRecognizeTaskTool,
} from "./recognizeMediaFilesTask.ts";

/**
 * The chat tools registered in `streamText({ tools })`, keyed by
 * their AI tool name constant. The object is constructed per-request
 * so each chat call gets tools bound to its own `clientId`,
 * `abortSignal`, and `UserConfig` snapshot.
 */
export interface ChatTools {
  [GET_APPLICATION_CONTEXT]: ReturnType<typeof buildGetApplicationContextTool>;
  [IS_FOLDER_EXIST]: ReturnType<typeof buildIsFolderExistTool>;
  [GET_MEDIA_METADATA]: ReturnType<typeof buildGetMediaMetadataTool>;
  [GET_EPISODES]: ReturnType<typeof buildGetEpisodesTool>;
  [GET_MEDIA_FOLDERS]: ReturnType<typeof buildGetMediaFoldersTool>;
  [LIST_FILES_IN_MEDIA_FOLDER]: ReturnType<typeof buildListFilesInMediaFolderTool>;
  [RENAME_FOLDER]: ReturnType<typeof buildRenameFolderTool>;
  [RENAME_EPISODE_FILE]: ReturnType<typeof buildRenameEpisodeFileTool>;
  [SCRAPE]: ReturnType<typeof buildScrapeTool>;
  [GET_JOB]: ReturnType<typeof buildGetJobTool>;
  [TMDB_SEARCH]: ReturnType<typeof buildTmdbSearchTool>;
  [TMDB_GET_MOVIE]: ReturnType<typeof buildTmdbGetMovieTool>;
  [TMDB_GET_TV_SHOW]: ReturnType<typeof buildTmdbGetTvShowTool>;
  [TVDB_SEARCH]: ReturnType<typeof buildTvdbSearchTool>;
  [TVDB_GET_MOVIE]: ReturnType<typeof buildTvdbGetMovieTool>;
  [TVDB_GET_TV_SHOW]: ReturnType<typeof buildTvdbGetTvShowTool>;
  [TVDB_GET_LANGUAGES]: ReturnType<typeof buildTvdbGetLanguagesTool>;
  [CREATE_RENAME_EPISODE_PLAN]: ReturnType<
    typeof buildCreateRenameEpisodePlanTool
  >;
  [BEGIN_RECOGNIZE_TASK]: ReturnType<typeof buildBeginRecognizeTaskTool>;
  [ADD_RECOGNIZED_MEDIA_FILE]: ReturnType<typeof buildAddRecognizedMediaFileTool>;
  [END_RECOGNIZE_TASK]: ReturnType<typeof buildEndRecognizeTaskTool>;
}

/**
 * Extra dependencies the host (cli / ohos) injects so the chat
 * tools can run inside core-routes. Optional override for rename
 * host-specific Core runners.
 */
export interface ChatToolsExtraDeps {
  /** Host Core runner for single-episode rename (Bun cli / Electron). */
  renameEpisodeFile?: RenameEpisodeFileRunner;
  /** Host Core runner for scrape job start. */
  scrapeFolder?: ScrapeFolderRunner;
  /** Host Core runner for job status lookup. */
  getJob?: GetJobRunner;
  /** Host Core runners for TMDB query tools. */
  tmdb?: TmdbToolRunners;
  /** Host Core runners for TVDB query tools. */
  tvdb?: TvdbToolRunners;
}

export interface CreateChatToolsArgs {
  config: ChatConfig;
  coreRoutesConfig?: CoreRoutesConfig;
  userConfig: UserConfig;
  clientId: string;
  abortSignal: AbortSignal | undefined;
  fs: ChatFs;
  extra?: ChatToolsExtraDeps;
}

/**
 * Build the full toolset for one chat request. Used by
 * {@link doChat} to assemble the `streamText({ tools })` map.
 */
export function createChatTools(args: CreateChatToolsArgs): ChatTools {
  const { config, coreRoutesConfig, userConfig, clientId, abortSignal, fs, extra } = args;
  const logger = config.logger ?? coreRoutesConfig?.logger;
  const acknowledge = config.acknowledge ?? defaultAcknowledge;
  const broadcast =
    coreRoutesConfig?.broadcast ?? config.broadcast ?? defaultBroadcast;

  // Build a synthetic `CoreRoutesConfig` for tools that need
  // `appDataDir` / `userDataDir` resolution (e.g. `getMediaMetadata`,
  // `getEpisodes`, `renameFolder`). On Linux these dirs differ
  // (`smm.json` lives in userDataDir). Falls back to `appDataDir`
  // when the host omits `userDataDir`.
  const syntheticConfig: CoreRoutesConfig = coreRoutesConfig ?? {
    allowlist: [],
    hello: {
      version: "0.0.0",
      userDataDir: config.userDataDir ?? config.appDataDir,
      appDataDir: config.appDataDir,
      logDir: "",
      tmpDir: "",
      reverseProxyUrl: null,
      osLocale: "en-US",
      coreRoutesPort: 0,
    },
    appDataDir: config.appDataDir,
    logger,
  };

  const tmdbRunners: TmdbToolRunners | undefined = extra?.tmdb;
  const tvdbRunners: TvdbToolRunners | undefined = extra?.tvdb;

  return {
    [GET_APPLICATION_CONTEXT]: buildGetApplicationContextTool(
      clientId,
      userConfig,
      (cfg) =>
        resolveAppLanguage({
          configured: cfg.applicationLanguage,
          osLocale: detectOsLocale(),
        }),
      acknowledge,
    ),
    [IS_FOLDER_EXIST]: buildIsFolderExistTool(),
    [GET_MEDIA_METADATA]: buildGetMediaMetadataTool(
      userConfig,
      config.appDataDir,
      abortSignal,
    ),
    [GET_EPISODES]: buildGetEpisodesTool(syntheticConfig, abortSignal),
    [GET_MEDIA_FOLDERS]: buildGetMediaFoldersTool(userConfig, abortSignal),
    [LIST_FILES_IN_MEDIA_FOLDER]: buildListFilesInMediaFolderTool(
      userConfig,
      abortSignal,
    ),
    [RENAME_FOLDER]: buildRenameFolderTool(
      clientId,
      syntheticConfig,
      abortSignal,
      acknowledge,
    ),
    [RENAME_EPISODE_FILE]: buildRenameEpisodeFileTool(
      clientId,
      extra?.renameEpisodeFile,
      abortSignal,
      acknowledge,
    ),
    [SCRAPE]: buildScrapeTool(extra?.scrapeFolder, abortSignal),
    [GET_JOB]: buildGetJobTool(extra?.getJob, abortSignal),
    [TMDB_SEARCH]: buildTmdbSearchTool(tmdbRunners, abortSignal),
    [TMDB_GET_MOVIE]: buildTmdbGetMovieTool(tmdbRunners, abortSignal),
    [TMDB_GET_TV_SHOW]: buildTmdbGetTvShowTool(tmdbRunners, abortSignal),
    [TVDB_SEARCH]: buildTvdbSearchTool(tvdbRunners, abortSignal),
    [TVDB_GET_MOVIE]: buildTvdbGetMovieTool(tvdbRunners, abortSignal),
    [TVDB_GET_TV_SHOW]: buildTvdbGetTvShowTool(tvdbRunners, abortSignal),
    [TVDB_GET_LANGUAGES]: buildTvdbGetLanguagesTool(tvdbRunners, abortSignal),
    [CREATE_RENAME_EPISODE_PLAN]: buildCreateRenameEpisodePlanTool(
      config.appDataDir,
      fs,
      broadcast,
      logger,
      abortSignal,
    ),
    [BEGIN_RECOGNIZE_TASK]: buildBeginRecognizeTaskTool(
      clientId,
      config.appDataDir,
      fs,
      broadcast,
      logger,
      abortSignal,
    ),
    [ADD_RECOGNIZED_MEDIA_FILE]: buildAddRecognizedMediaFileTool(
      clientId,
      config.appDataDir,
      fs,
      logger,
      abortSignal,
    ),
    [END_RECOGNIZE_TASK]: buildEndRecognizeTaskTool(
      clientId,
      config.appDataDir,
      fs,
      broadcast,
      logger,
      abortSignal,
    ),
  };
}

export { defaultChatFs };
