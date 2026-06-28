import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { defaultChatFs } from "../chatFs.ts";
import { defaultRenameFilesTaskDeps } from "../tools/renameFilesTaskDefaults.ts";
import { RENAME_FOLDER } from "@smm/core/types/ai-tools/renameFolder";
import { registerAddRecognizedFileTool } from "./toolHandlers/addRecognizedFile.ts";
import { registerAddRenameFileTool } from "./toolHandlers/addRenameFile.ts";
import { registerBeginRecognizeTaskTool } from "./toolHandlers/beginRecognizeTask.ts";
import { registerBeginRenameTaskTool } from "./toolHandlers/beginRenameTask.ts";
import { registerEndRecognizeTaskTool } from "./toolHandlers/endRecognizeTask.ts";
import { registerEndRenameTaskTool } from "./toolHandlers/endRenameTask.ts";
import { registerGetApplicationContextTool } from "./toolHandlers/getApplicationContext.ts";
import { registerGetEpisodeTool } from "./toolHandlers/getEpisode.ts";
import { registerGetEpisodesTool } from "./toolHandlers/getEpisodes.ts";
import { registerGetMediaFoldersTool } from "./toolHandlers/getMediaFolders.ts";
import { registerGetMediaMetadataTool } from "./toolHandlers/getMediaMetadata.ts";
import { registerIsFolderExistTool } from "./toolHandlers/isFolderExist.ts";
import { registerListFilesTool } from "./toolHandlers/listFiles.ts";
import { registerRenameFolderTool } from "./toolHandlers/renameFolder.ts";
import { registerStaticTextTools } from "./toolHandlers/staticText.ts";
import type { McpConfig } from "./types.ts";

/**
 * HTTP request handler for the MCP server. Created by
 * {@link createMcpStreamableHttpHandler}. Mirrors the original
 * `getMcpStreamableHttpHandler` return shape from
 * `apps/cli/src/mcp/mcp.ts`.
 */
export type McpRequestHandler = (req: Request) => Promise<Response>;

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
  const fs = config.fs ?? defaultChatFs();
  const renameFilesTaskDeps = defaultRenameFilesTaskDeps(config.appDataDir);

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

  // Core toolset — order mirrors the original `apps/cli` MCP server.
  await registerGetApplicationContextTool(server, config);
  registerGetMediaFoldersTool(server, config);
  registerIsFolderExistTool(server, config);
  registerListFilesTool(server, config);
  registerGetMediaMetadataTool(server, config);

  // Read-only documentation tools.
  registerStaticTextTools(server, config);

  // Folder-level rename. Skipped when the host disables it via
  // `McpConfig.disabledTools` (e.g. HarmonyOS cannot rename folders
  // due to sandbox permissions — see `apps/ohos/src/http/mcp.ts`).
  if (!config.disabledTools?.includes(RENAME_FOLDER)) {
    registerRenameFolderTool(server, config);
  }

  // Episode-level rename task (begin / add / end).
  registerBeginRenameTaskTool(server, config, renameFilesTaskDeps);
  registerAddRenameFileTool(server, config, renameFilesTaskDeps);
  registerEndRenameTaskTool(server, config, renameFilesTaskDeps);

  // Episode recognition task (begin / add / end).
  registerBeginRecognizeTaskTool(server, config);
  registerAddRecognizedFileTool(server, config);
  registerEndRecognizeTaskTool(server, config);

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
