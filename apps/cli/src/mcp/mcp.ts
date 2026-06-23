import {
  createMcpStreamableHttpHandler,
  type McpConfig,
  type McpRequestHandler,
} from "@smm/core-routes";
import { GET_APPLICATION_CONTEXT } from "@smm/core/types/ai-tools/getApplicationContext";
import { IS_FOLDER_EXIST } from "@smm/core/types/ai-tools/isFolderExist";
import { GET_MEDIA_FOLDERS } from "@smm/core/types/ai-tools/getMediaFolders";
import { GET_MEDIA_METADATA } from "@smm/core/types/ai-tools/getMediaMetadata";
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
import { GET_EPISODES } from "@smm/core/types/ai-tools/getEpisodes";
import { getAppDataDir } from "@/utils/config";
import { acknowledge, broadcast } from "@/utils/socketIO";
import { logger } from "../../lib/logger";
import { getLocalizedToolDescription } from "@/i18n/helpers";
import { initI18n } from "@/i18n/config";

/**
 * Tool names that have localized descriptions in
 * `apps/cli/public/locales/<lang>/tools.json`. The English defaults
 * from `@smm/core/types/ai-tools` are used when the key is missing
 * or `getLocalizedToolDescription` returns the key itself.
 */
const LIST_FILES_KEY = "list-files";
const GET_EPISODE_KEY = "get-episode";
const HOW_TO_RENAME_KEY = "how-to-rename-episode-video-files";
const HOW_TO_RECOGNIZE_KEY = "how-to-recognize-episode-video-files";
const README_KEY = "readme";

const TOOL_NAME_KEYS = [
  GET_APPLICATION_CONTEXT,
  IS_FOLDER_EXIST,
  GET_MEDIA_FOLDERS,
  GET_MEDIA_METADATA,
  LIST_FILES_KEY,
  RENAME_FOLDER,
  BEGIN_RENAME_FILES_TASK,
  ADD_RENAME_FILE_TO_TASK,
  END_RENAME_FILES_TASK,
  BEGIN_RECOGNIZE_TASK,
  ADD_RECOGNIZED_MEDIA_FILE,
  END_RECOGNIZE_TASK,
  GET_EPISODES,
  GET_EPISODE_KEY,
  HOW_TO_RENAME_KEY,
  HOW_TO_RECOGNIZE_KEY,
  README_KEY,
] as const;

let handlerPromise: Promise<McpRequestHandler> | null = null;

/**
 * Clears the cached HTTP handler promise. Call this when the MCP
 * server is stopped so the next {@link getMcpStreamableHttpHandler}
 * call creates a fresh handler. This also allows recovery after a
 * failed handler creation attempt.
 */
export function resetMcpStreamableHttpHandler(): void {
  handlerPromise = null;
}

/**
 * Resolve every localized description we ship with the MCP server.
 * Each call hits the i18next layer which reads from
 * `apps/cli/public/locales/<lang>/tools.json`. Returns a map keyed
 * by the tool-name constants used in core-routes' MCP factory.
 */
async function loadLocalizedToolDescriptions(): Promise<Record<string, string>> {
  // Initialise i18n if it has not been initialised yet — the MCP
  // server can be started before the chat pipeline that does the
  // initial `initI18n` call in `apps/cli/index.ts`.
  try {
    await initI18n();
  } catch (err) {
    logger.warn(
      { err },
      "[mcp] initI18n failed, falling back to English descriptions",
    );
  }

  const descriptions: Record<string, string> = {};
  for (const toolName of TOOL_NAME_KEYS) {
    try {
      const description = await getLocalizedToolDescription(toolName);
      // `getLocalizedToolDescription` returns the key itself when
      // missing — skip those so the English default takes over.
      if (description && description !== toolName) {
        descriptions[toolName] = description;
      }
    } catch (err) {
      logger.warn(
        { err, toolName },
        "[mcp] failed to load localized description, using English",
      );
    }
  }
  return descriptions;
}

/**
 * Build the {@link McpConfig} that the cli (Bun) passes into the
 * core-routes MCP factory. Inject:
 * - `getUserConfig` from `apps/cli`'s Bun-based config reader.
 * - `appDataDir` from the platform-specific data dir helper.
 * - `acknowledge` from the Socket.IO manager (used for
 *   `getApplicationContext` and rename/recognize plan broadcasts).
 * - Localized tool descriptions loaded from i18next.
 */
async function buildMcpConfig(): Promise<McpConfig> {
  const { getUserConfig } = await import("@/utils/config");
  return {
    getUserConfig,
    appDataDir: getAppDataDir(),
    acknowledge: (message, timeoutMs) =>
      acknowledge(message as Parameters<typeof acknowledge>[0], timeoutMs),
    broadcast: (message) =>
      broadcast(message as Parameters<typeof broadcast>[0]),
    toolDescriptions: await loadLocalizedToolDescriptions(),
    logger: {
      debug: (obj, msg) => logger.debug(obj, msg),
      info: (obj, msg) => logger.info(obj, msg),
      warn: (obj, msg) => logger.warn(obj, msg),
      error: (obj, msg) => logger.error(obj, msg),
    },
  };
}

/**
 * Returns a request handler for MCP Streamable HTTP. Creates the
 * MCP server and transport on first call and reuses them for
 * subsequent requests. Backed by the shared
 * {@link createMcpStreamableHttpHandler} from `@smm/core-routes`,
 * so the same tool implementations also run on the OHOS Electron
 * main process.
 */
export async function getMcpStreamableHttpHandler(): Promise<McpRequestHandler> {
  if (handlerPromise) {
    return handlerPromise;
  }
  handlerPromise = (async () => {
    const config = await buildMcpConfig();
    const handler = await createMcpStreamableHttpHandler(config);

    // === DIAGNOSTIC: wrap handler with logging ===
    return async (req: Request): Promise<Response> => {
      console.log(
        `[mcp-cli-diag] handler wrapper invoked: ${req.method} ${req.url}`,
      );
      const response = await handler(req);
      console.log(
        `[mcp-cli-diag] handler returned: status=${response.status}, ctor=${response.constructor.name}`,
      );
      return response;
    };
  })();
  return handlerPromise;
}
