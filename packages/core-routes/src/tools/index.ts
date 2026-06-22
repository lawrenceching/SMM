import type { UserConfig } from "@smm/core/types";
import { resolveAppLanguage, detectOsLocale } from "@smm/core/locale";
import { GET_APPLICATION_CONTEXT } from "@smm/core/types/ai-tools/getApplicationContext";
import { IS_FOLDER_EXIST } from "@smm/core/types/ai-tools/isFolderExist";
import { GET_MEDIA_METADATA } from "@smm/core/types/ai-tools/getMediaMetadata";
import { GET_EPISODES } from "@smm/core/types/ai-tools/getEpisodes";
import { GET_MEDIA_FOLDERS } from "@smm/core/types/ai-tools/getMediaFolders";
import { LIST_FILES_IN_MEDIA_FOLDER } from "@smm/core/types/ai-tools/listFilesInMediaFolder";
import { RENAME_FOLDER } from "@smm/core/types/ai-tools/renameFolder";
import {
  BEGIN_RENAME_FILES_TASK,
  ADD_RENAME_FILE_TO_TASK,
  END_RENAME_FILES_TASK,
} from "@smm/core/types/ai-tools/renameFilesTask";
import {
  BEGIN_RECOGNIZE_TASK,
  ADD_RECOGNIZED_MEDIA_FILE,
  END_RECOGNIZE_TASK,
} from "@smm/core/types/ai-tools/recognizeMediaFileTask";
import type { CoreRoutesConfig } from "../types.ts";
import { defaultChatFs } from "../chatFs.ts";
import type { ChatConfig, ChatFs } from "../chatTypes.ts";
import { defaultAcknowledge } from "./acknowledge.ts";
import { buildGetApplicationContextTool } from "./getApplicationContext.ts";
import { buildIsFolderExistTool } from "./isFolderExist.ts";
import { buildGetMediaMetadataTool } from "./getMediaMetadata.ts";
import { buildGetEpisodesTool } from "./getEpisodes.ts";
import { buildGetMediaFoldersTool } from "./getMediaFolders.ts";
import { buildListFilesInMediaFolderTool } from "./listFilesInMediaFolder.ts";
import { buildRenameFolderTool } from "./renameFolder.ts";
import {
  buildAddRenameFileToTaskTool,
  buildBeginRenameFilesTaskTool,
  buildEndRenameFilesTaskTool,
  type RenameFilesTaskDeps,
} from "./renameFilesTask.ts";
import { defaultRenameFilesTaskDeps } from "./renameFilesTaskDefaults.ts";
import {
  buildAddRecognizedMediaFileTool,
  buildBeginRecognizeTaskTool,
  buildEndRecognizeTaskTool,
} from "./recognizeMediaFilesTask.ts";

/**
 * The 13 chat tools registered in `streamText({ tools })`, keyed by
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
  [BEGIN_RENAME_FILES_TASK]: ReturnType<typeof buildBeginRenameFilesTaskTool>;
  [ADD_RENAME_FILE_TO_TASK]: ReturnType<typeof buildAddRenameFileToTaskTool>;
  [END_RENAME_FILES_TASK]: ReturnType<typeof buildEndRenameFilesTaskTool>;
  [BEGIN_RECOGNIZE_TASK]: ReturnType<typeof buildBeginRecognizeTaskTool>;
  [ADD_RECOGNIZED_MEDIA_FILE]: ReturnType<typeof buildAddRecognizedMediaFileTool>;
  [END_RECOGNIZE_TASK]: ReturnType<typeof buildEndRecognizeTaskTool>;
}

/**
 * Extra dependencies the host (cli / ohos) injects so the chat
 * tools can run inside core-routes. Optional override for rename
 * validation/metadata lookup; defaults to
 * {@link defaultRenameFilesTaskDeps} when omitted.
 */
export interface ChatToolsExtraDeps {
  renameFilesTask?: RenameFilesTaskDeps;
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

  // Build a synthetic `CoreRoutesConfig` for tools that need
  // `appDataDir` / `allowlist` resolution (e.g. `getMediaMetadata`,
  // `getEpisodes`, `renameFolder`). The chat config exposes
  // `appDataDir` directly so the host can set it without providing
  // a full `CoreRoutesConfig`.
  const syntheticConfig: CoreRoutesConfig = coreRoutesConfig ?? {
    allowlist: [],
    hello: {
      version: "0.0.0",
      userDataDir: config.appDataDir,
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

  // Same deps as the MCP rename tools: metadata cache read +
  // bundled rename validation. Hosts can override via `extra`.
  const renameFilesTaskDeps =
    extra?.renameFilesTask ?? defaultRenameFilesTaskDeps(config.appDataDir);

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
    [BEGIN_RENAME_FILES_TASK]: buildBeginRenameFilesTaskTool(
      clientId,
      config.appDataDir,
      fs,
      renameFilesTaskDeps,
      logger,
      abortSignal,
    ),
    [ADD_RENAME_FILE_TO_TASK]: buildAddRenameFileToTaskTool(
      clientId,
      config.appDataDir,
      fs,
      renameFilesTaskDeps,
      logger,
      abortSignal,
    ),
    [END_RENAME_FILES_TASK]: buildEndRenameFilesTaskTool(
      clientId,
      config.appDataDir,
      fs,
      // The end-tool broadcasts a Socket.IO event; we reuse the
      // host's `acknowledge` as a fire-and-forget emitter. The cli
      // wires `acknowledge` to `manager.broadcast`.
      acknowledge,
      logger,
      abortSignal,
    ),
    [BEGIN_RECOGNIZE_TASK]: buildBeginRecognizeTaskTool(
      clientId,
      config.appDataDir,
      fs,
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
      acknowledge,
      logger,
      abortSignal,
    ),
  };
}

export { defaultChatFs };
