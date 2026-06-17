import { stat } from "node:fs/promises";
import { Path } from "@smm/core/path";
import {
  createBaseGetMediaMetadataData,
  fillMediaMetadataResponseData,
} from "@smm/core/ai-tool/getMediaMetadataResponse";
import { requireNonEmptyString } from "@smm/core/ai-tool/toolResult";
import {
  GET_MEDIA_METADATA,
  GET_MEDIA_METADATA_DESCRIPTION,
  GET_MEDIA_METADATA_FOLDER_NOT_FOUND,
  GET_MEDIA_METADATA_NOT_DIRECTORY,
  GET_MEDIA_METADATA_NOT_MANAGED,
  GET_MEDIA_METADATA_NO_CACHE,
  getMediaMetadataInputSchema,
  getMediaMetadataToolOutputSchema,
  type GetMediaMetadataToolOutput,
} from "@smm/core/types/ai-tools/getMediaMetadata";
import type { UserConfig } from "@smm/core/types";
import { readMediaMetadataCache } from "../mediaMetadataCache.ts";

/**
 * Pure execution of `getMediaMetadata`. Mirrors
 * `executeGetMediaMetadata` from `apps/cli/src/tools/getMediaMetadata.ts`.
 */
export async function executeGetMediaMetadata(
  params: { mediaFolderPath: string },
  userConfig: UserConfig,
  appDataDir: string,
  abortSignal?: AbortSignal,
): Promise<GetMediaMetadataToolOutput> {
  if (abortSignal?.aborted) {
    throw new Error("Request was aborted");
  }

  const pathCheck = requireNonEmptyString(
    params.mediaFolderPath,
    "mediaFolderPath",
  );
  if (typeof pathCheck !== "string") {
    return {
      ...createBaseGetMediaMetadataData(""),
      error: pathCheck.error,
    };
  }

  const baseData = createBaseGetMediaMetadataData(pathCheck);

  if (!isMediaFolderManagedFromConfig(userConfig, pathCheck)) {
    return { ...baseData, error: GET_MEDIA_METADATA_NOT_MANAGED };
  }

  try {
    const normalizedPath = Path.toPlatformPath(pathCheck);

    try {
      const stats = await stat(normalizedPath);
      if (!stats.isDirectory()) {
        return { ...baseData, error: GET_MEDIA_METADATA_NOT_DIRECTORY };
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return { ...baseData, error: GET_MEDIA_METADATA_FOLDER_NOT_FOUND };
      }
      throw error;
    }

    const posixPath = Path.posix(pathCheck);
    const metadata = await readMediaMetadataCache(appDataDir, posixPath);

    if (!metadata) {
      return { ...baseData, error: GET_MEDIA_METADATA_NO_CACHE };
    }

    return fillMediaMetadataResponseData(metadata, posixPath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Error reading media metadata: ${message}`);
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
 * Build the AI SDK `streamText` tool object for `GET_MEDIA_METADATA`.
 */
export function buildGetMediaMetadataTool(
  userConfig: UserConfig,
  appDataDir: string,
  abortSignal?: AbortSignal,
) {
  return {
    description: GET_MEDIA_METADATA_DESCRIPTION,
    inputSchema: getMediaMetadataInputSchema,
    outputSchema: getMediaMetadataToolOutputSchema,
    execute: async (args: unknown) => {
      const params = (args ?? {}) as { mediaFolderPath?: string };
      return executeGetMediaMetadata(
        { mediaFolderPath: params.mediaFolderPath ?? "" },
        userConfig,
        appDataDir,
        abortSignal,
      );
    },
  };
}

/** Re-exported tool name constant for the tools registry. */
export const GET_MEDIA_METADATA_TOOL_NAME = GET_MEDIA_METADATA;
