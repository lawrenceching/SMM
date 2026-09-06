import { randomUUID } from "node:crypto";
import type { RecognizeMediaFilePlan } from "@smm/types/RecognizeMediaFilePlan";
import type { FsPort } from "../ports/FsPort";
import { writePlan } from "./plans";

export interface CreateRecognizeEpisodePlanOptions {
  creator?: "app" | "ai";
  id?: string;
}

export interface CreateRecognizeEpisodePlanDeps {
  fs: FsPort;
  appDataDir: string;
  normalizePosix: (path: string) => string;
  createId?: () => string;
}

export async function createRecognizeEpisodePlanPipeline(
  mediaFolderPath: string,
  files: Array<{ season: number; episode: number; path: string }>,
  options: CreateRecognizeEpisodePlanOptions | undefined,
  deps: CreateRecognizeEpisodePlanDeps,
): Promise<RecognizeMediaFilePlan> {
  const posixFolder = deps.normalizePosix(mediaFolderPath);

  if (files.length === 0) {
    throw new Error("No recognize entries in task");
  }

  const normalizedFiles = files.map((file) => ({
    season: file.season,
    episode: file.episode,
    path: deps.normalizePosix(file.path),
  }));

  const seenPaths = new Set<string>();
  const seenEpisodes = new Set<string>();
  for (const file of normalizedFiles) {
    if (seenPaths.has(file.path)) {
      throw new Error(`Duplicate file path in task: ${file.path}`);
    }
    seenPaths.add(file.path);

    const episodeKey = `${file.season}-${file.episode}`;
    if (seenEpisodes.has(episodeKey)) {
      throw new Error(
        `Duplicate season/episode in task: S${file.season}E${file.episode}`,
      );
    }
    seenEpisodes.add(episodeKey);

    if (!(await deps.fs.exists(file.path))) {
      throw new Error(
        `File "${file.path}" (S${file.season}E${file.episode}) does not exist in the media folder`,
      );
    }
  }

  const createId = deps.createId ?? randomUUID;
  const id = options?.id ?? createId();

  const plan: RecognizeMediaFilePlan = {
    id,
    task: "recognize-media-file",
    status: "pending",
    creator: options?.creator ?? "app",
    mediaFolderPath: posixFolder,
    files: normalizedFiles,
  };

  await writePlan(deps.fs, deps.appDataDir, plan);
  return plan;
}
