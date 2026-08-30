import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Path } from "@smm/utils/path";
import {
  RENAME_EPISODE_FILE,
  RENAME_EPISODE_FILE_DESCRIPTION,
  renameEpisodeFileInputSchema,
  renameEpisodeFileOutputSchema,
} from "@smm/types/ai-tools/renameEpisodeFile";
import { buildRenameEpisodeFileConfirmationMessage } from "@smm/core/ai-tool/renameEpisodeFileConfirm";
import { renameEpisodeFileCancelled } from "@smm/core/ai-tool/renameEpisodeFileResult";
import {
  createErrorResponse,
  createSuccessResponse,
  type McpToolResponse,
} from "../index.ts";
import type { McpConfig } from "../types.ts";
import { executeRenameEpisodeFile } from "../../tools/renameEpisodeFile.ts";

/**
 * Register the `rename-episode-file` MCP tool.
 * When `acknowledge` is set, asks the UI for confirmation first.
 * Execution uses `McpConfig.renameEpisodeFile` (typically Core).
 */
export function registerRenameEpisodeFileTool(
  server: McpServer,
  config: McpConfig,
): void {
  const description =
    config.toolDescriptions?.[RENAME_EPISODE_FILE] ?? RENAME_EPISODE_FILE_DESCRIPTION;

  server.registerTool(
    RENAME_EPISODE_FILE,
    {
      description,
      inputSchema: renameEpisodeFileInputSchema,
      outputSchema: renameEpisodeFileOutputSchema,
    },
    async (args: unknown): Promise<McpToolResponse> => {
      const params = (args ?? {}) as {
        mediaFolder?: string;
        from?: string;
        to?: string;
      };
      if (typeof params.mediaFolder !== "string" || params.mediaFolder.trim() === "") {
        return createErrorResponse(
          "Invalid path: 'mediaFolder' must be a non-empty string",
        );
      }
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
        if (config.acknowledge) {
          const confirmationMessage = buildRenameEpisodeFileConfirmationMessage(
            params.from,
            params.to,
          );
          const responseData = (await config.acknowledge(
            {
              event: "askForConfirmation",
              data: { message: confirmationMessage },
              clientId: "mcp",
            },
            30_000,
          )) as { confirmed?: boolean; response?: string } | undefined;

          const confirmed =
            responseData?.confirmed ?? responseData?.response === "yes";
          if (!confirmed) {
            return createSuccessResponse(
              renameEpisodeFileCancelled(
                params.mediaFolder,
                params.from,
                params.to,
              ) as { [x: string]: unknown },
            );
          }
        }

        const result = await executeRenameEpisodeFile(
          {
            mediaFolder: params.mediaFolder,
            from: params.from,
            to: params.to,
          },
          config.renameEpisodeFile,
        );

        if (result.renamed) {
          config.broadcast?.({
            event: "mediaMetadataUpdated",
            data: {
              folderPath: Path.posix(params.mediaFolder),
            },
          });
        }

        if (result.error && !result.renamed) {
          return createSuccessResponse(result as { [x: string]: unknown });
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
