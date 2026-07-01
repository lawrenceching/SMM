import type { UserConfig } from "@smm/core/types";
import type { ChatFs } from "../chatTypes.ts";
import type { CoreRoutesLogger } from "../types.ts";
import type { WebSocketMessage } from "../socketIO/types.ts";

/**
 * Configuration for the MCP server factory.
 *
 * The MCP server is created by {@link createMcpStreamableHttpHandler}.
 * All runtime-specific concerns (config file reading, Socket.IO
 * acknowledge, filesystem access) are injected via this interface so
 * the same tool implementations work on both Bun (`apps/cli`) and
 * Node.js (`apps/ohos` Electron main process).
 */
export interface McpConfig {
  /**
   * Reads the current `UserConfig` from disk. Each host (cli / ohos)
   * supplies its own implementation — Bun uses `Bun.file()`, Node
   * uses `node:fs/promises`.
   */
  getUserConfig: () => Promise<UserConfig>;

  /**
   * App data dir used to resolve `{appDataDir}/plans/*.plan.json`
   * storage for `rename-files-task` and `recognize-media-file-task`
   * tools, and to look up the media metadata cache.
   */
  appDataDir: string;

  /**
   * User data dir used to locate `smm.json` (the {@link UserConfig}
   * file). On Linux (XDG) this is `~/.config/smm`, distinct from
   * `appDataDir` (`~/.local/share/smm`); on Windows and macOS the
   * two paths are the same. MCP tool handlers that need to look up
   * managed folders must read user config from this path — using
   * `appDataDir` here would silently break managed-folder checks on
   * Linux (see PR fixing `get-episodes` / `rename-folder` synthetic
   * config).
   */
  userDataDir: string;

  /**
   * Socket.IO broadcast for fire-and-forget UI notifications
   * (`RenameFilesPlanReady`, `RecognizeMediaFilePlanReady`, etc.).
   */
  broadcast?: (message: WebSocketMessage) => void;

  /**
   * Socket.IO acknowledge for tools that need UI interaction
   * (`getApplicationContext`, `renameFolder` confirmation, etc.).
   * Optional: tools degrade gracefully when absent.
   */
  acknowledge?: (
    message: unknown,
    timeoutMs?: number,
  ) => Promise<unknown>;

  /**
   * Filesystem primitives for reading/writing metadata cache and
   * plan files. Defaults to `node:fs/promises` (works for both
   * Bun and Node). Override if the host needs custom semantics.
   */
  fs?: ChatFs;

  /**
   * Logger for MCP server diagnostics. Falls back to a console
   * adapter when absent.
   */
  logger?: CoreRoutesLogger;

  /**
   * Optional list of MCP tool names to omit from the server. Hosts
   * that cannot satisfy a tool's runtime requirements (e.g. HarmonyOS
   * cannot rename folders due to sandbox permissions) pass the
   * affected tool names here so the MCP `tools/list` response never
   * advertises them. Defaults to registering every tool.
   *
   * Use the constants from `@smm/core/types/ai-tools/*`
   * (e.g. `RENAME_FOLDER`).
   */
  disabledTools?: readonly string[];

  /**
   * Optional localized tool descriptions, keyed by tool name
   * (e.g. `"get-media-folders"`, `"is-folder-exist"`). When
   * omitted, English defaults from `@smm/core/types/ai-tools/*`
   * are used. `apps/cli` injects the user's preferred language
   * here via its i18next setup.
   */
  toolDescriptions?: Record<string, string>;

  /**
   * Re-activate persisted `file://` folder access before listing.
   * Required on HarmonyOS when external MCP clients call `list-files`
   * without going through the renderer's file-access IPC.
   */
  activatePersistedFileAccess?: (paths: string[]) => void | Promise<void>;
}

/**
 * Standard MCP tool response interface. Mirrors the `McpServer`
 * `registerTool` callback return shape so handlers can be written
 * once and registered on the server.
 */
export interface McpToolResponse {
  content: Array<{
    type: "text";
    text: string;
    annotations?: {
      audience?: ("user" | "assistant")[];
      priority?: number;
      lastModified?: string;
    };
    _meta?: { [key: string]: unknown };
  }>;
  structuredContent?: { [x: string]: unknown };
  isError?: boolean;
  _meta?: { [key: string]: unknown };
  [key: string]: unknown;
}
