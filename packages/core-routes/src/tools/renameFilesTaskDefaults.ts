import { readMediaMetadataCache } from "../mediaMetadataCache.ts";
import { validateRenameOperations } from "../renameFilesValidation.ts";
import type { RenameFilesTaskDeps } from "./renameFilesTask.ts";

/**
 * Default {@link RenameFilesTaskDeps} implementation backed by
 * core-routes' runtime-neutral metadata cache and the bundled
 * {@link validateRenameOperations} validator. Hosts (Bun cli or
 * Node OHOS) can use this directly or supply their own.
 *
 * - `validateOperations` — runs the same checks as the original
 *   `apps/cli/src/tools/renameFilesInBatch.ts#validateRenameOperations`.
 * - `getMediaMetadata` — reads `{appDataDir}/metadata/*.json` via
 *   `node:fs/promises`, so it works on both Bun and Node.
 */
export function defaultRenameFilesTaskDeps(
  appDataDir: string,
): RenameFilesTaskDeps {
  return {
    validateOperations: async (files, folderPathInPosix) => {
      return validateRenameOperations(files, folderPathInPosix);
    },
    getMediaMetadata: async (folderPathInPosix: string) => {
      return (await readMediaMetadataCache(appDataDir, folderPathInPosix)) ??
        null;
    },
  };
}
