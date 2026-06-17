import { Path } from "@smm/core/path";
import {
  buildListFilesInMediaFolderResponse,
  createEmptyListFilesInMediaFolderData,
} from "@smm/core/ai-tool/buildListFilesInMediaFolderResponse";
import { formatToolError, requireNonEmptyString, toolOk } from "@smm/core/ai-tool/toolResult";
import {
  LIST_FILES_IN_MEDIA_FOLDER,
  LIST_FILES_IN_MEDIA_FOLDER_DESCRIPTION,
  LIST_FILES_IN_MEDIA_FOLDER_INVALID_PATH,
  LIST_FILES_IN_MEDIA_FOLDER_NOT_MANAGED,
  listFilesInMediaFolderInputSchema,
  listFilesInMediaFolderOutputSchema,
  type ListFilesInMediaFolderToolOutput,
} from "@smm/core/types/ai-tools/listFilesInMediaFolder";
import type { UserConfig } from "@smm/core/types";
import { doListFiles } from "../listFiles.ts";
import { isMediaFolderManaged } from "../userConfig.ts";

/**
 * Pure execution of `listFilesInMediaFolder`. Mirrors the
 * `executeListFilesInMediaFolder` agent function from
 * `apps/cli/src/tools/listFilesInMediaFolder.ts` but takes the
 * pre-resolved `UserConfig` snapshot so the tool does not need to
 * touch the filesystem-bound config reader.
 */
export async function executeListFilesInMediaFolder(
  params: {
    mediaFolderPath: string;
    recursively?: boolean;
    videoFileOnly?: boolean;
  },
  userConfig: UserConfig,
  abortSignal?: AbortSignal,
): Promise<ListFilesInMediaFolderToolOutput> {
  if (abortSignal?.aborted) {
    throw new Error("Request was aborted");
  }

  const pathCheck = requireNonEmptyString(
    params.mediaFolderPath,
    "mediaFolderPath",
  );
  if (typeof pathCheck !== "string") {
    return {
      ...createEmptyListFilesInMediaFolderData(),
      error: LIST_FILES_IN_MEDIA_FOLDER_INVALID_PATH,
    };
  }

  const empty = createEmptyListFilesInMediaFolderData();

  // Use the same managed-folder check semantics as the rest of core-
  // routes — compare POSIX + native-platform path. The caller already
  // has the `CoreRoutesConfig`, but we accept a pre-resolved
  // `UserConfig` snapshot for symmetry with the other tools and to
  // keep this function pure for testing.
  if (!isMediaFolderManagedFromConfig(userConfig, pathCheck)) {
    return { ...empty, error: LIST_FILES_IN_MEDIA_FOLDER_NOT_MANAGED };
  }

  try {
    const listResult = await doListFiles({
      path: pathCheck,
      recursively: params.recursively ?? true,
      onlyFiles: true,
    });

    if (listResult.error) {
      return { ...empty, error: listResult.error };
    }

    const filePaths =
      listResult.data?.items
        .filter((item) => !item.isDirectory)
        .map((item) => item.path) ?? [];

    return toolOk(
      buildListFilesInMediaFolderResponse(
        filePaths,
        params.videoFileOnly ?? false,
      ),
    );
  } catch (error) {
    return {
      ...empty,
      ...formatToolError(error),
    };
  }
}

function isMediaFolderManagedFromConfig(
  userConfig: UserConfig,
  mediaFolderPath: string,
): boolean {
  const targetPlatform = Path.toPlatformPath(mediaFolderPath);
  const targetPosix = Path.posix(mediaFolderPath);
  return (userConfig.folders ?? []).some((folder) => {
    return (
      Path.toPlatformPath(folder) === targetPlatform ||
      Path.posix(folder) === targetPosix
    );
  });
}

/**
 * Build the AI SDK `streamText` tool object for `LIST_FILES_IN_MEDIA_FOLDER`.
 */
export function buildListFilesInMediaFolderTool(
  userConfig: UserConfig,
  abortSignal?: AbortSignal,
) {
  return {
    description: LIST_FILES_IN_MEDIA_FOLDER_DESCRIPTION,
    inputSchema: listFilesInMediaFolderInputSchema,
    outputSchema: listFilesInMediaFolderOutputSchema,
    execute: async (args: unknown) => {
      const params = (args ?? {}) as {
        mediaFolderPath?: string;
        recursively?: boolean;
        videoFileOnly?: boolean;
      };
      return executeListFilesInMediaFolder(
        {
          mediaFolderPath: params.mediaFolderPath ?? "",
          recursively: params.recursively,
          videoFileOnly: params.videoFileOnly,
        },
        userConfig,
        abortSignal,
      );
    },
  };
}

/** Re-exported tool name constant for the tools registry. */
export const LIST_FILES_IN_MEDIA_FOLDER_TOOL_NAME = LIST_FILES_IN_MEDIA_FOLDER;
