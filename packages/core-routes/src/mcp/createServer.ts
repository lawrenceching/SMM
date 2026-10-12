import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { RENAME_FOLDER } from "@smm/types/ai-tools/renameFolder";
import { RENAME_EPISODE_FILE } from "@smm/types/ai-tools/renameEpisodeFile";
import { registerCreateRecognizeEpisodePlanTool } from "./toolHandlers/createRecognizeEpisodePlan.ts";
import { registerCreateRenameEpisodePlanTool } from "./toolHandlers/createRenameEpisodePlan.ts";
import { registerGetApplicationContextTool } from "./toolHandlers/getApplicationContext.ts";
import { registerGetEpisodeTool } from "./toolHandlers/getEpisode.ts";
import { registerGetEpisodesTool } from "./toolHandlers/getEpisodes.ts";
import { registerGetMediaFoldersTool } from "./toolHandlers/getMediaFolders.ts";
import { registerGetMediaMetadataTool } from "./toolHandlers/getMediaMetadata.ts";
import { registerIsFolderExistTool } from "./toolHandlers/isFolderExist.ts";
import { registerListFilesTool } from "./toolHandlers/listFiles.ts";
import { registerRenameFolderTool } from "./toolHandlers/renameFolder.ts";
import { registerRenameEpisodeFileTool } from "./toolHandlers/renameEpisodeFile.ts";
import { registerScrapeTool } from "./toolHandlers/scrape.ts";
import { registerGetJobTool } from "./toolHandlers/getJob.ts";
import { registerTmdbTools } from "./toolHandlers/tmdbTools.ts";
import { registerTvdbTools } from "./toolHandlers/tvdbTools.ts";
import { registerStaticTextTools } from "./toolHandlers/staticText.ts";
import type { McpConfig } from "./types.ts";
import { logAccess, serializeErrorForLog, truncateForLog } from "../accessLog.ts";
import type { CoreRoutesLogger } from "../types.ts";
import { SCRAPE } from "@smm/types/ai-tools/scrape";
import { GET_JOB } from "@smm/types/ai-tools/getJob";

/**
 * HTTP request handler for the MCP server. Created by
 * {@link createMcpStreamableHttpHandler}. Mirrors the original
 * `getMcpStreamableHttpHandler` return shape from
 * `apps/cli/src/mcp/mcp.ts`.
 */
export type McpRequestHandler = (req: Request) => Promise<Response>;

/**
 * Callback shape every `register*Tool` call site in this file uses:
 * `(args, extra) => Promise<McpToolResponse>`.
 */
type McpToolCallback = (args: unknown, extra: unknown) => Promise<unknown>;

/**
 * Wrap one MCP tool callback so each invocation emits a single
 * `msg:"access"` entry: args (truncated), outcome derived from the
 * protocol-level `isError` flag, duration — and, when the callback
 * itself throws, the error summary (rethrown unchanged).
 */
export function wrapToolCallbackWithAccessLog(
  toolName: string,
  cb: McpToolCallback,
  logger: CoreRoutesLogger | undefined,
): McpToolCallback {
  return async (args, extra) => {
    const started = performance.now();
    try {
      const result = await cb(args, extra);
      const isError =
        typeof result === "object" &&
        result !== null &&
        "isError" in result &&
        (result as { isError?: unknown }).isError === true;
      logAccess(logger, {
        source: "mcp",
        tool: toolName,
        args: truncateForLog(args),
        outcome: isError ? "error" : "ok",
        durationMs: Math.round(performance.now() - started),
      });
      return result;
    } catch (error) {
      logAccess(logger, {
        source: "mcp",
        tool: toolName,
        args: truncateForLog(args),
        outcome: "error",
        err: serializeErrorForLog(error),
        durationMs: Math.round(performance.now() - started),
      });
      throw error;
    }
  };
}

/**
 * Create a request handler for the MCP Streamable HTTP transport.
 *
 * Mirrors the `apps/cli/src/mcp/mcp.ts` implementation but:
 * - Uses runtime-neutral core-routes agent tools instead of
 *   Bun-specific `apps/cli/src/tools/*`.
 * - Accepts all host-specific concerns via {@link McpConfig}
 *   (`getUserConfig`, `appDataDir`, `acknowledge`, `fs`, `logger`).
 * - Lazily creates a fresh transport per request (stateless mode),
 *   so the handler is safe to use from a long-running HTTP server
 *   on either Bun or Node.
 *
 * @example
 * ```ts
 * // apps/cli (Bun)
 * const handler = await createMcpStreamableHttpHandler({
 *   getUserConfig,
 *   appDataDir: getAppDataDir(),
 *   acknowledge,
 *   toolDescriptions: await loadLocalizedToolDescriptions(),
 * });
 * mcpServer = Bun.serve({ fetch: handler });
 *
 * // apps/ohos (Node http)
 * const handler = await createMcpStreamableHttpHandler({
 *   getUserConfig: nodeGetUserConfig,
 *   appDataDir: hello.appDataDir,
 *   acknowledge: socketManager.acknowledge,
 * });
 * // mount `handler` on POST /mcp/*
 * ```
 */
export async function createMcpStreamableHttpHandler(
  config: McpConfig,
): Promise<McpRequestHandler> {
  const server = new McpServer(
    {
      name: "Simple Media Manager (SMM)",
      version: "1.0.0",
      description:
        "Simple Media Manager (SMM) exposes tools to query media from TMDB and manage media folder in SMM",
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  // Access log (docs/access-log.md): interpose on `registerTool` so
  // every `tools/call` produces exactly one `msg:"access"` entry.
  // Casts are required because `registerTool` is generic on the SDK
  // side, while every call site passes the same runtime shape
  // `(name, config, async (args) => McpToolResponse)`.
  const rawRegisterTool = server.registerTool.bind(server);
  const registerToolWithAccessLog = (
    name: string,
    toolConfig: Parameters<typeof rawRegisterTool>[1],
    cb: unknown,
  ): ReturnType<typeof rawRegisterTool> =>
    rawRegisterTool(
      name,
      toolConfig,
      wrapToolCallbackWithAccessLog(
        name,
        cb as unknown as McpToolCallback,
        config.logger,
      ) as unknown as Parameters<typeof rawRegisterTool>[2],
    );
  server.registerTool =
    registerToolWithAccessLog as typeof server.registerTool;

  // Core toolset — order mirrors the original `apps/cli` MCP server.
  await registerGetApplicationContextTool(server, config);
  registerGetMediaFoldersTool(server, config);
  registerIsFolderExistTool(server, config);
  registerListFilesTool(server, config);
  registerGetMediaMetadataTool(server, config);
  registerTmdbTools(server, config);
  registerTvdbTools(server, config);

  // Read-only documentation tools.
  registerStaticTextTools(server, config);

  // Folder-level rename. Skipped when the host disables it via
  // `McpConfig.disabledTools` (e.g. HarmonyOS cannot rename folders
  // due to sandbox permissions — see `apps/ohos/src/http/mcp.ts`).
  if (!config.disabledTools?.includes(RENAME_FOLDER)) {
    registerRenameFolderTool(server, config);
  }

  if (!config.disabledTools?.includes(RENAME_EPISODE_FILE)) {
    registerRenameEpisodeFileTool(server, config);
  }

  if (!config.disabledTools?.includes(SCRAPE)) {
    registerScrapeTool(server, config);
  }

  if (!config.disabledTools?.includes(GET_JOB)) {
    registerGetJobTool(server, config);
  }

  // Episode-level rename plan.
  registerCreateRenameEpisodePlanTool(server, config);

  // Episode recognition plan (single call).
  registerCreateRecognizeEpisodePlanTool(server, config);

  // Episode lookup.
  registerGetEpisodeTool(server, config);
  registerGetEpisodesTool(server, config);

  // Attach an initial transport. The handler below replaces it on
  // every request so the server stays in stateless mode.
  await server.connect(new WebStandardStreamableHTTPServerTransport({}));

  return async (req: Request): Promise<Response> => {
    // Stateless mode — each request gets a fresh transport. Close
    // the previous transport connection first so `server.connect`
    // can attach a new one (the server keeps its tool registrations).
    await server.close();
    const transport = new WebStandardStreamableHTTPServerTransport({});
    await server.connect(transport);

    return transport.handleRequest(req);
  };
}
