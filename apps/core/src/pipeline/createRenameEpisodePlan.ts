import { randomUUID } from "node:crypto";
import { assertEpisodeVideoFile, assertMediaFolderHasMetadata } from "@core/plan/renamePlan";
import { validateRenameOperations } from "@core/validations/rename/validateRenameOperations";
import type { RenameFileExistenceProbe } from "@core/validations/rename/validateRenameFileExistence";
import type { MediaMetadata } from "@smm/core";
import type { RenameFilesPlan } from "@smm/core/types/RenameFilesPlan";
import type { FsPort } from "../ports/FsPort";
import { writePlan } from "./plans";

function renameFileExistenceProbe(fs: FsPort): RenameFileExistenceProbe {
  return {
    isFile: async (path: string): Promise<boolean> => {
      if (fs.isFile) {
        return fs.isFile(path);
      }
      return fs.exists(path);
    },
  };
}

export interface CreateRenameEpisodePlanOptions {
  creator?: "app" | "ai";
  id?: string;
  /** When true, allow files: [] (rule path when names already match). Default false. */
  allowEmptyFiles?: boolean;
}

export interface CreateRenameEpisodePlanDeps {
  fs: FsPort;
  appDataDir: string;
  normalizePosix: (path: string) => string;
  getMediaMetadata: (folder: string) => Promise<MediaMetadata | null>;
  createId?: () => string;
}

export async function createRenameEpisodePlanPipeline(
  mediaFolderPath: string,
  files: Array<{ from: string; to: string }>,
  options: CreateRenameEpisodePlanOptions | undefined,
  deps: CreateRenameEpisodePlanDeps,
): Promise<RenameFilesPlan> {
  const posixFolder = deps.normalizePosix(mediaFolderPath);

  const mm = await deps.getMediaMetadata(posixFolder);
  const metadataError = assertMediaFolderHasMetadata(!!mm, posixFolder);
  if (metadataError) {
    throw new Error(metadataError);
  }

  const normalizedFiles = files.map((entry) => ({
    from: deps.normalizePosix(entry.from),
    to: deps.normalizePosix(entry.to),
  }));

  const allowEmptyFiles = options?.allowEmptyFiles ?? false;
  if (normalizedFiles.length === 0 && !allowEmptyFiles) {
    throw new Error("No rename entries in task");
  }

  for (const entry of normalizedFiles) {
    const episodeError = assertEpisodeVideoFile(mm!, entry.from);
    if (episodeError) {
      throw new Error(episodeError);
    }
  }

  if (normalizedFiles.length > 0) {
    const validation = await validateRenameOperations(
      normalizedFiles,
      posixFolder,
      renameFileExistenceProbe(deps.fs),
    );
    if (!validation.isValid) {
      throw new Error(validation.errors.join("; "));
    }
  }

  const createId = deps.createId ?? randomUUID;
  const id = options?.id ?? createId();

  const plan: RenameFilesPlan = {
    id,
    task: "rename-files",
    status: "pending",
    creator: options?.creator ?? "app",
    mediaFolderPath: posixFolder,
    files: normalizedFiles,
  };

  await writePlan(deps.fs, deps.appDataDir, plan);
  return plan;
}
