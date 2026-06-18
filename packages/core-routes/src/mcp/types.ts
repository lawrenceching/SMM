import type { UserConfig } from "@smm/core/types";
import type { ChatFs } from "../chatTypes.ts";
import type { CoreRoutesLogger } from "../types.ts";

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
   * Optional localized tool descriptions, keyed by tool name
   * (e.g. `"get-media-folders"`, `"is-folder-exist"`). When
   * omitted, English defaults from `@smm/core/types/ai-tools/*`
   * are used. `apps/cli` injects the user's preferred language
   * here via its i18next setup.
   */
  toolDescriptions?: Record<string, string>;
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
