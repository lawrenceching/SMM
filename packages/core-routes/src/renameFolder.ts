import { rename } from "node:fs/promises";
import { z } from "zod/v3";
import { renameFolderInMediaMetadata } from "@smm/core/mediaMetadata";
import { Path } from "@smm/core/path";
import { renameFolderInUserConfig } from "@smm/core/userConfig";
import type { FolderRenameRequestBody, FolderRenameResponseBody } from "@smm/core/types";
import {
  deleteMediaMetadataCache,
  readMediaMetadataCache,
  writeMediaMetadataCache,
} from "./mediaMetadataCache.ts";
import type { CoreRoutesConfig } from "./types.ts";
import {
  isMediaFolderManaged,
  readUserConfig,
  resolveAppDataDir,
  writeUserConfigToDisk,
} from "./userConfig.ts";

const renameFolderRequestSchema = z.object({
  from: z.string().min(1, "Source folder path is required, in POSIX format"),
  to: z.string().min(1, "Destination folder path is required, in POSIX format"),
});

export async function doRenameFolder(
  body: FolderRenameRequestBody,
  config: CoreRoutesConfig = {},
): Promise<FolderRenameResponseBody> {
  try {
    const validationResult = renameFolderRequestSchema.safeParse(body);
    if (!validationResult.success) {
      return {
        error: `Validation Failed: ${validationResult.error.issues.map((i) => i.message).join(", ")}`,
      };
    }

    const { from, to } = validationResult.data;
    const fromAsPosix = Path.posix(from);
    const toAsPosix = Path.posix(to);

    if (!(await isMediaFolderManaged(from, config))) {
      config.logger?.error(
        { from: fromAsPosix, to: toAsPosix },
        "[renameFolder] source folder is not managed by SMM",
      );
      return {
        error: `${fromAsPosix} is not managed by SMM`,
      };
    }

    const appDataDir = resolveAppDataDir(config);
    if (!appDataDir) {
      return { error: "appDataDir is not configured" };
    }

    const mediaMetadata = await readMediaMetadataCache(appDataDir, fromAsPosix);
    if (!mediaMetadata) {
      config.logger?.error(
        { from: fromAsPosix, to: toAsPosix },
        "[renameFolder] media metadata not found",
      );
      return {
        error: `Media metadata not found: ${from}`,
      };
    }

    const updatedMetadata = renameFolderInMediaMetadata(
      mediaMetadata,
      fromAsPosix,
      toAsPosix,
    );
    await writeMediaMetadataCache(appDataDir, updatedMetadata);
    await deleteMediaMetadataCache(appDataDir, fromAsPosix);

    const userConfig = await readUserConfig(config);
    const newUserConfig = renameFolderInUserConfig(
      userConfig,
      fromAsPosix,
      toAsPosix,
    );
    await writeUserConfigToDisk(config, newUserConfig);

    await rename(
      Path.toPlatformPath(fromAsPosix),
      Path.toPlatformPath(toAsPosix),
    );

    config.logger?.info(
      { from: fromAsPosix, to: toAsPosix },
      "[renameFolder] renamed media folder",
    );

    return {};
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    config.logger?.error({ error: message }, "[renameFolder] unexpected error");
    return {
      error: `Unexpected Error: ${message}`,
    };
  }
}
