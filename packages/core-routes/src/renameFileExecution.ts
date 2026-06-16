import { mkdir, rename, stat } from "node:fs/promises";
import path from "node:path";
import { Path } from "@smm/core/path";

export interface RenameExecutionResult {
  success: boolean;
  errors?: string[];
  successfulRenames?: Array<{ from: string; to: string }>;
}

async function directoryExists(dirPath: string): Promise<boolean> {
  try {
    const stats = await stat(dirPath);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

async function executeRenameOperation(
  from: string,
  to: string,
): Promise<{ success: boolean; error?: string }> {
  const fromPathPlatform = new Path(from).platformAbsPath();
  const toPathPlatform = new Path(to).platformAbsPath();

  try {
    const destDir = path.dirname(toPathPlatform);
    await mkdir(destDir, { recursive: true });

    if (!(await directoryExists(destDir))) {
      return {
        success: false,
        error: `Destination directory does not exist and could not be created: ${destDir}`,
      };
    }

    await rename(fromPathPlatform, toPathPlatform);
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return {
      success: false,
      error: errorMessage.includes("ENOENT")
        ? `Source file does not exist: ${fromPathPlatform}`
        : errorMessage,
    };
  }
}

export async function executeBatchRenameOperations(
  renameMappings: Array<{ from: string; to: string }>,
  _options: { logPrefix?: string } = {},
): Promise<RenameExecutionResult> {
  if (renameMappings.length === 0) {
    return {
      success: false,
      errors: ["No rename operations provided"],
    };
  }

  const errors: string[] = [];
  const successfulRenames: Array<{ from: string; to: string }> = [];

  for (const renameMapping of renameMappings) {
    const result = await executeRenameOperation(renameMapping.from, renameMapping.to);

    if (result.success) {
      successfulRenames.push(renameMapping);
    } else {
      errors.push(
        `Failed to rename "${renameMapping.from}" to "${renameMapping.to}": ${result.error ?? "Unknown error"}`,
      );
    }
  }

  if (errors.length > 0) {
    return {
      success: false,
      errors,
      successfulRenames: successfulRenames.length > 0 ? successfulRenames : undefined,
    };
  }

  return {
    success: true,
    successfulRenames,
  };
}
