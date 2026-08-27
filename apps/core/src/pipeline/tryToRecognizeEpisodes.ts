import { randomUUID } from "node:crypto";
import { Path } from "@core/path";
import type { MediaMetadata } from "@smm/core";
import type { RecognizeMediaFilePlan, RecognizedFile } from "@smm/core/types/RecognizeMediaFilePlan";
import type { FsPort } from "../ports/FsPort";
import { metadataCachePath } from "./paths";
import { writePlan } from "./plans";
import { recognizeEpisodes } from "./recognizeEpisodes";
import type { UserConfigHelper } from "./userConfigHelper";

export interface TryToRecognizeEpisodesDeps {
  fs: FsPort;
  appDataDir: string;
  userConfig: UserConfigHelper;
  normalizePosix: (path: string) => string;
  /** Injected for tests; default `randomUUID` from `node:crypto`. */
  createId?: () => string;
}

function isManaged(folders: string[], mediaFolderPath: string): boolean {
  const targetPlatform = Path.toPlatformPath(mediaFolderPath);
  const targetPosix = Path.posix(mediaFolderPath);
  return folders.some(
    (folder) =>
      Path.toPlatformPath(folder) === targetPlatform || Path.posix(folder) === targetPosix,
  );
}

function hasTvShowEpisodes(mm: MediaMetadata): boolean {
  if (mm.type !== "tvshow-folder") return false;
  const seasons = mm.tvShow?.seasons;
  if (!seasons || seasons.length === 0) return false;
  return seasons.some((season) => (season.episodes?.length ?? 0) > 0);
}

/** Rule-based episode matching → pending recognize-media-file plan (throws instead of { error }). */
export async function tryToRecognizeEpisodesPipeline(
  path: string,
  deps: TryToRecognizeEpisodesDeps,
): Promise<RecognizeMediaFilePlan> {
  const posixPath = deps.normalizePosix(path);
  const createId = deps.createId ?? randomUUID;

  const config = await deps.userConfig.read();
  if (!isManaged(config.folders ?? [], path)) {
    throw new Error(`${posixPath} is not managed by SMM`);
  }

  const cachePath = metadataCachePath(deps.appDataDir, posixPath);
  if (!(await deps.fs.exists(cachePath))) {
    throw new Error(`Media metadata not found: ${path}`);
  }
  let mediaMetadata: MediaMetadata;
  try {
    mediaMetadata = JSON.parse(await deps.fs.readTextFile(cachePath)) as MediaMetadata;
  } catch {
    throw new Error(`Media metadata not found: ${path}`);
  }

  if (!hasTvShowEpisodes(mediaMetadata)) {
    throw new Error(`Folder is not a TV show with episodes: ${path}`);
  }

  const listed = await deps.fs.listFiles(posixPath);
  const listedPosix = listed.map((file) => Path.posix(file));
  const recognized = recognizeEpisodes({
    ...mediaMetadata,
    mediaFolderPath: posixPath,
    files: listedPosix,
  });

  const files: RecognizedFile[] = recognized.map((item) => ({
    season: item.season,
    episode: item.episode,
    path: Path.posix(item.file),
  }));

  const plan: RecognizeMediaFilePlan = {
    id: createId(),
    task: "recognize-media-file",
    status: "pending",
    creator: "app",
    mediaFolderPath: posixPath,
    files,
  };

  await writePlan(deps.fs, deps.appDataDir, plan);
  return plan;
}
