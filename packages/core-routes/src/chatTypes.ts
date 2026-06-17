import type { IncomingMessage, ServerResponse } from "node:http";
import type { UserConfig } from "@smm/core/types";
import type { WebSocketMessage } from "./socketIO/types.ts";
import type { CoreRoutesLogger } from "./types.ts";

/**
 * Per-request shape sent by the UI's `AssistantChatTransport` and any
 * programmatic AI client. Mirrors `ChatTask.processChatRequest`'s
 * `ChatRequest`.
 */
export interface ChatRequestBody {
  messages?: unknown[];
  model?: string;
  tools?: unknown;
  system?: string;
  clientId: string;
}

/**
 * Factory that creates an OpenAI-compatible provider + model name from
 * the current `UserConfig`. The factory is supplied by the app (cli or
 * ohos) because `core-routes` deliberately stays framework- and
 * environment-agnostic — it does not know how the user picks an AI
 * provider or where the API key is read from.
 */
export interface AIProviderFactory {
  (userConfig: UserConfig): {
    /** Any AI-SDK language model (`streamText` accepts the wider `LanguageModelV2`). */
    provider: unknown;
    model: string;
  } | Promise<{
    provider: unknown;
    model: string;
  }>;
}

/**
 * Filesystem abstraction for the chat toolset.
 *
 * `core-routes` was Bun-aware in the original `ChatTask.ts`
 * (`Bun.file`, `Bun.write`) and is being ported to be runtime-neutral.
 * The implementations pass these primitives through, so both Node
 * (OHOS Electron) and Bun (cli) work without a build-time switch.
 */
export interface ChatFs {
  /**
   * Read a file and parse it as JSON. Returns `null` if the file does
   * not exist. Throws on other I/O errors.
   */
  readJson<T = unknown>(filePath: string): Promise<T | null>;
  /** Write a JSON-serializable value to a file (pretty-printed). */
  writeJson(filePath: string, value: unknown): Promise<void>;
  /** Returns true if `filePath` exists. */
  exists(filePath: string): Promise<boolean>;
}

/**
 * Configuration the chat handler needs beyond what
 * {@link CoreRoutesConfig} already provides. Injected by the app
 * (cli / ohos) so the same chat logic works in both runtimes.
 */
export interface ChatConfig {
  /**
   * Creates the AI provider/model from the current `UserConfig`. Throws
   * if no provider is selected or required fields are missing — the
   * error becomes a `400` HTTP response.
   */
  createAIProvider: AIProviderFactory;
  /**
   * Reads the current `UserConfig`. Called on every chat request so
   * users can switch AI providers between requests.
   */
  getUserConfig: () => Promise<UserConfig>;
  /**
   * Optional fallback system prompt used when the request omits
   * `body.system`. Defaults to `SYSTEM_PROMPT` from
   * `@smm/core/ai-tool/systemPrompt`.
   */
  systemPrompt?: string;
  /**
   * Logger used for request-level diagnostics. Falls back to
   * `ctx.config.logger` if omitted.
   */
  logger?: CoreRoutesLogger;
  /**
   * Socket.IO acknowledge for the chat toolset (used by
   * `getApplicationContext`, `listFilesInMediaFolder`, etc.). Falls
   * back to a 1-second-timeout no-op if omitted. The message is
   * `unknown` so the host (cli / ohos) can pass any concrete
   * `WebSocketMessage` shape without re-wrapping it; the chat tools
   * build the message they need.
   */
  acknowledge?: (
    message: unknown,
    timeoutMs?: number,
  ) => Promise<unknown>;
  /**
   * Filesystem primitives for reading/writing metadata cache + plan
   * files. Defaults to a Node `fs/promises`-based implementation
   * (works for both cli Bun and OHOS Node).
   */
  fs?: ChatFs;
  /**
   * App data dir used to resolve the `{appDataDir}/plans/*.plan.json`
   * storage for `rename-files-task` and `recognize-media-file-task`
   * tools. Required when those tools are used.
   */
  appDataDir: string;
}
