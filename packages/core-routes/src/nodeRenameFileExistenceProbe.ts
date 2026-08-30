import { stat } from "node:fs/promises";
import { Path } from "@smm/core/path";
import type { RenameFileExistenceProbe } from "@smm/core/validations/rename/validateRenameFileExistence";

function statWithTimeout(
  filePath: string,
  timeoutMs: number,
): Promise<Awaited<ReturnType<typeof stat>>> {
  return Promise.race([
    stat(filePath),
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`stat timeout for path: ${filePath}`)),
        timeoutMs,
      ),
    ),
  ]);
}

/**
 * Node/Bun probe for rename FS preflight (`node:fs` at the host boundary).
 * Paths are POSIX; converted to platform paths before `stat`.
 */
export function createNodeRenameFileExistenceProbe(
  timeoutMs: number = 1000,
): RenameFileExistenceProbe {
  return {
    async isFile(posixPath: string): Promise<boolean> {
      try {
        const stats = await statWithTimeout(Path.toPlatformPath(posixPath), timeoutMs);
        return stats?.isFile() ?? false;
      } catch {
        return false;
      }
    },
  };
}
