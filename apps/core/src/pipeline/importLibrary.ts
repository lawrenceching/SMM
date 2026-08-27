import { Path } from "@core/path";
import type { FolderType } from "@smm/core";
import type { ImportLibraryJobTask } from "../jobs/types";
import { createBlankMediaMetadata } from "./importFolderPipeline";
import type { PersistedMediaMetadata } from "./mediaMetadataValidation";

/** Skip folders already present in user config (POSIX path comparison). */
export function dedupLibraryFolders(newFolders: string[], existingFolderPaths: string[]): string[] {
  const importedPosix = new Set(existingFolderPaths.map((p) => Path.posix(p)));
  return newFolders.filter((folder) => !importedPosix.has(Path.posix(folder)));
}

export function createImportLibraryTasks(jobId: string, folderPaths: string[]): ImportLibraryJobTask[] {
  return folderPaths.map((path, index) => ({
    id: `${jobId}-task-${index}`,
    path,
    status: "pending" as const,
  }));
}

export function patchImportLibraryTask(
  tasks: ImportLibraryJobTask[],
  taskId: string,
  patch: Partial<ImportLibraryJobTask>,
): ImportLibraryJobTask[] {
  return tasks.map((task) => (task.id === taskId ? { ...task, ...patch } : task));
}

export function importLibraryJobProgress(tasks: ImportLibraryJobTask[]): number {
  if (tasks.length === 0) return 100;
  const completed = tasks.filter((task) => task.status === "succeeded" || task.status === "failed").length;
  return Math.floor((completed / tasks.length) * 100);
}

export function importLibraryTaskPaths(tasks: ImportLibraryJobTask[]): string[] {
  return tasks.map((task) => task.path);
}

export interface PrepareLibraryFoldersDeps {
  writeBlankMetadata: (metadata: PersistedMediaMetadata) => Promise<void>;
  upsertFolders: (folders: string[]) => Promise<void>;
}

/** Loop #1: blank metadata per folder, then batch upsert folders in UserConfig. */
export async function prepareLibraryFoldersForImport(
  folders: string[],
  type: FolderType,
  deps: PrepareLibraryFoldersDeps,
): Promise<void> {
  for (const folder of folders) {
    const blank = createBlankMediaMetadata(folder, type);
    const { files: _files, ...toPersist } = blank;
    await deps.writeBlankMetadata(toPersist);
  }
  if (folders.length > 0) {
    await deps.upsertFolders(folders);
  }
}
