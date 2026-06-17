import {
  GET_MEDIA_FOLDERS,
  GET_MEDIA_FOLDERS_DESCRIPTION,
  getMediaFoldersInputSchema,
  getMediaFoldersOutputSchema,
  type GetMediaFoldersToolOutput,
} from "@smm/core/types/ai-tools/getMediaFolders";
import {
  buildGetMediaFoldersResponse,
  createEmptyGetMediaFoldersData,
} from "@smm/core/ai-tool/buildGetMediaFoldersResponse";
import { formatToolError, toolOk } from "@smm/core/ai-tool/toolResult";
import type { UserConfig } from "@smm/core/types";

/**
 * Core `getMediaFolders` execution. Pure of HTTP / framework — takes
 * a {@link UserConfig} snapshot and returns the AI-tool-shaped output.
 */
export async function executeGetMediaFolders(
  userConfig: UserConfig,
  abortSignal?: AbortSignal,
): Promise<GetMediaFoldersToolOutput> {
  if (abortSignal?.aborted) {
    throw new Error("Request was aborted");
  }
  try {
    return toolOk(buildGetMediaFoldersResponse(userConfig));
  } catch (error) {
    return {
      ...createEmptyGetMediaFoldersData(),
      ...formatToolError(error),
    };
  }
}

/**
 * Build the AI SDK `streamText` tool object for `GET_MEDIA_FOLDERS`.
 * Bound to a per-request `UserConfig` snapshot.
 */
export function buildGetMediaFoldersTool(
  userConfig: UserConfig,
  abortSignal?: AbortSignal,
) {
  return {
    description: GET_MEDIA_FOLDERS_DESCRIPTION,
    inputSchema: getMediaFoldersInputSchema,
    outputSchema: getMediaFoldersOutputSchema,
    execute: async () => executeGetMediaFolders(userConfig, abortSignal),
  };
}

/** Re-exported tool name constant for the tools registry. */
export const GET_MEDIA_FOLDERS_TOOL_NAME = GET_MEDIA_FOLDERS;
