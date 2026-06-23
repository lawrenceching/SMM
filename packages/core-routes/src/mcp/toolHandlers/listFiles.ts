import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  buildListFilesInMediaFolderResponse,
  createEmptyListFilesInMediaFolderData,
} from "@smm/core/ai-tool/buildListFilesInMediaFolderResponse";
import {
  createErrorResponse,
  createSuccessResponse,
  type McpToolResponse,
} from "../index.ts";
import type { McpConfig } from "../types.ts";
import { doListFiles } from "../../listFiles.ts";

/**
 * Input schema for the MCP `list-files` tool. Generic filesystem
 * listing — does not require the folder to be a managed media
 * folder (in contrast with the agent's
 * `LIST_FILES_IN_MEDIA_FOLDER` tool).
 */
const listFilesInputSchema = z.object({
  folderPath: z
    .string()
    .describe("The absolute path of the folder to list files from"),
  recursive: z
    .boolean()
    .optional()
    .default(false)
    .describe("Whether to list files recursively (default: false)"),
  filter: z
    .string()
    .optional()
    .describe("Filter pattern for files/folders (supports wildcards)"),
  videoFileOnly: z
    .boolean()
    .optional()
    .default(false)
    .describe("Whether to return only video files (default: false)"),
});

const listFilesOutputSchema = z.object({
  files: z.array(z.string()).describe("Array of file paths"),
  count: z.number().describe("Number of files listed"),
});

const TOOL_NAME = "list-files";
const TOOL_DESCRIPTION =
  "List all files in a folder. Accepts paths in POSIX or Windows format. " +
  "Returns plain file paths (no managed-folder check) so this tool is the " +
  "preferred way for an external AI assistant to inspect a media folder's " +
  "contents.";

/**
 * Register the `list-files` MCP tool. Generic filesystem listing
 * (no managed-folder check), backed by the runtime-neutral
 * `doListFiles` from `core-routes`.
 */
export function registerListFilesTool(
  server: McpServer,
  config: McpConfig,
): void {
  const description = config.toolDescriptions?.[TOOL_NAME] ?? TOOL_DESCRIPTION;

  server.registerTool(
    TOOL_NAME,
    {
      description,
      inputSchema: listFilesInputSchema,
      outputSchema: listFilesOutputSchema,
    },
    async (args: unknown): Promise<McpToolResponse> => {
      const params = (args ?? {}) as {
        folderPath?: string;
        recursive?: boolean;
        videoFileOnly?: boolean;
      };
      const { folderPath, recursive, videoFileOnly } = params;

      if (
        typeof folderPath !== "string" ||
        folderPath.trim() === ""
      ) {
        return createErrorResponse(
          "Invalid path: 'folderPath' must be a non-empty string",
        );
      }

      try {
        const listResult = await doListFiles(
          {
            path: folderPath,
            recursively: recursive ?? false,
            onlyFiles: true,
          },
          {
            logger: config.logger,
            activatePersistedFileAccess: config.activatePersistedFileAccess,
          },
        );

        if (listResult.error) {
          return createErrorResponse(listResult.error);
        }

        const filePaths =
          listResult.data?.items
            .filter((item) => !item.isDirectory)
            .map((item) => item.path) ?? [];

        const empty = createEmptyListFilesInMediaFolderData();
        const data = buildListFilesInMediaFolderResponse(
          filePaths,
          videoFileOnly ?? false,
        );
        return createSuccessResponse({
          ...empty,
          ...data,
        });
      } catch (error) {
        return createErrorResponse(
          error instanceof Error ? error.message : String(error),
        );
      }
    },
  );
}
