import { z } from "zod/v3";
import { getMediaFolder } from "@smm/core/getMediaFolder";
import { updateMediaMetadataAfterRename } from "@smm/core/mediaMetadata";
import { Path } from "@smm/core/path";
import type { RenameFilesRequestBody, RenameFilesResponseBody } from "@smm/core/types";
import {
  readMediaMetadataCache,
  writeMediaMetadataCache,
} from "./mediaMetadataCache.ts";
import { executeBatchRenameOperations } from "./renameFileExecution.ts";
import type { CoreRoutesConfig } from "./types.ts";
import { readUserConfig, resolveAppDataDir } from "./userConfig.ts";
import { validateRenameOperations } from "./validateRenameOperations.ts";

const requestSchema = z.object({
  files: z
    .array(
      z.object({
        from: z.string().min(1, "The source file path, absolute path in platform-specific format"),
        to: z.string().min(1, "The target file path, absolute path in platform-specific format"),
      }),
    )
    .min(1, "At least one file rename is required"),
  traceId: z.string().optional(),
  mediaFolder: z.string().optional(),
  clientId: z.string().optional(),
});

async function updateMediaMetadataAndBroadcast(
  mediaFolder: string,
  renameMappings: Array<{ from: string; to: string }>,
  config: CoreRoutesConfig,
  clientId?: string,
): Promise<void> {
  const appDataDir = resolveAppDataDir(config);
  if (!appDataDir) {
    config.logger?.warn({ mediaFolder }, "[renameFiles] appDataDir not configured, skip metadata update");
    return;
  }

  const mediaMetadata = await readMediaMetadataCache(appDataDir, mediaFolder);
  if (!mediaMetadata) {
    config.logger?.debug({ mediaFolder }, "[renameFiles] media metadata not found, skip update");
    return;
  }

  const mediaFolderPosix = Path.posix(mediaFolder);
  if (mediaMetadata.mediaFolderPath !== mediaFolderPosix) {
    config.logger?.warn(
      { providedPath: mediaFolderPosix, metadataPath: mediaMetadata.mediaFolderPath },
      "[renameFiles] folder path mismatch, skip metadata update",
    );
    return;
  }

  const updatedMediaMetadata = updateMediaMetadataAfterRename(mediaMetadata, renameMappings);
  await writeMediaMetadataCache(appDataDir, updatedMediaMetadata);

  config.broadcast?.({
    clientId,
    event: "mediaMetadataUpdated",
    data: {
      folderPath: mediaFolderPosix,
    },
  });
}

export async function doRenameFiles(
  body: RenameFilesRequestBody,
  config: CoreRoutesConfig = {},
  headerClientId?: string,
): Promise<RenameFilesResponseBody> {
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join(", ");
    return { error: `Validation Failed: ${msg}` };
  }

  const { files, traceId, mediaFolder: mediaFolderFromBody, clientId: clientIdFromBody } = parsed.data;
  const effectiveClientId = headerClientId ?? clientIdFromBody;
  const logCtx = traceId ? { traceId } : {};

  const userConfig = await readUserConfig(config);
  const mediaFolderPath =
    mediaFolderFromBody ?? getMediaFolder(files[0]!.from, userConfig.folders ?? []);

  if (mediaFolderPath === null) {
    return { error: `Media folder not found for ${files[0]!.from}` };
  }

  const mediaFolderInPosix = Path.posix(mediaFolderPath);
  const validationResult = await validateRenameOperations(files, mediaFolderInPosix);

  if (!validationResult.isValid) {
    return { error: validationResult.errors.join(", ") };
  }

  const renameResult = await executeBatchRenameOperations(validationResult.validatedRenames, {
    logPrefix: "[POST /api/renameFiles]",
  });

  const succeeded = (renameResult.successfulRenames ?? []).map((r) => r.from);
  const failed: Array<{ path: string; error: string }> = [];

  if (!renameResult.success && renameResult.errors) {
    for (const errMsg of renameResult.errors) {
      const match = errMsg.match(/^Failed to rename "([^"]+)"/);
      failed.push({ path: match?.[1] ?? "unknown", error: errMsg });
    }
  }

  config.logger?.info(
    { ...logCtx, succeededCount: succeeded.length, failedCount: failed.length },
    "[POST /api/renameFiles] completed",
  );

  if (renameResult.successfulRenames && renameResult.successfulRenames.length > 0) {
    await updateMediaMetadataAndBroadcast(
      mediaFolderInPosix,
      renameResult.successfulRenames,
      config,
      effectiveClientId,
    );
  }

  return {
    data: {
      succeeded,
      failed,
    },
  };
}
