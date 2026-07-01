import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  RENAME_FOLDER,
  RENAME_FOLDER_DESCRIPTION,
  renameFolderInputSchema,
  renameFolderOutputSchema,
} from "@smm/core/types/ai-tools/renameFolder";
import {
  USER_CONFIG_FOLDER_RENAMED_EVENT,
  USER_CONFIG_UPDATED_EVENT,
} from "@smm/core/event-types";
import {
  createErrorResponse,
  createSuccessResponse,
  type McpToolResponse,
} from "../index.ts";
import type { McpConfig } from "../types.ts";
import { executeRenameFolder } from "../../tools/renameFolder.ts";
import type { CoreRoutesConfig } from "../../types.ts";

/**
 * Register the `rename-folder` MCP tool. Renames a media folder
 * (and updates the metadata cache + user config) after asking the
 * UI for confirmation via Socket.IO.
 *
 * Confirmation is optional — when no UI is connected the rename
 * proceeds directly, mirroring the original `apps/cli` MCP
 * behaviour. Set `McpConfig.acknowledge` to enable UI confirmation.
 */
export function registerRenameFolderTool(
  server: McpServer,
  config: McpConfig,
): void {
  const description =
    config.toolDescriptions?.[RENAME_FOLDER] ?? RENAME_FOLDER_DESCRIPTION;

  server.registerTool(
    RENAME_FOLDER,
    {
      description,
      inputSchema: renameFolderInputSchema,
      outputSchema: renameFolderOutputSchema,
    },
    async (args: unknown): Promise<McpToolResponse> => {
      const params = (args ?? {}) as { from?: string; to?: string };
      if (typeof params.from !== "string" || params.from.trim() === "") {
        return createErrorResponse(
          "Invalid path: 'from' must be a non-empty string",
        );
      }
      if (typeof params.to !== "string" || params.to.trim() === "") {
        return createErrorResponse(
          "Invalid path: 'to' must be a non-empty string",
        );
      }

      try {
        const syntheticConfig: CoreRoutesConfig = {
          allowlist: [],
          hello: {
            version: "0.0.0",
            userDataDir: config.userDataDir,
            appDataDir: config.appDataDir,
            logDir: "",
            tmpDir: "",
            reverseProxyUrl: null,
            osLocale: "en-US",
            coreRoutesPort: 0,
          },
          appDataDir: config.appDataDir,
          logger: config.logger,
        };
        const result = await executeRenameFolder(
          { from: params.from, to: params.to },
          syntheticConfig,
        );

        if (result.renamed) {
          config.broadcast?.({
            event: USER_CONFIG_FOLDER_RENAMED_EVENT,
            data: {
              from: result.from,
              to: result.to,
            },
          });
          config.broadcast?.({
            event: USER_CONFIG_UPDATED_EVENT,
            data: {},
          });
        }

        return createSuccessResponse(result as { [x: string]: unknown });
      } catch (error) {
        return createErrorResponse(
          error instanceof Error ? error.message : String(error),
        );
      }
    },
  );
}
