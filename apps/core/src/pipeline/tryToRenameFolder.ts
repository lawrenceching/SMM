import { randomUUID } from "node:crypto";
import { Path } from "@core/path";
import type { MediaMetadata } from "@smm/core";
import type { RenameFilesPlan } from "@smm/core/types/RenameFilesPlan";
import type { FsPort } from "../ports/FsPort";
import { buildTvShowRenamePlanFileEntries } from "./buildTvShowRenamePlanFileEntries";
import { createRenameEpisodePlanPipeline } from "./createRenameEpisodePlan";
import { metadataCachePath } from "./paths";
import type { RenameRuleName } from "./renameRules";
import type { UserConfigHelper } from "./userConfigHelper";

export interface TryToRenameFolderDeps {
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

function assertSupportedRule(rule: string | undefined): asserts rule is RenameRuleName | undefined {
  if (rule !== undefined && rule !== "plex" && rule !== "emby") {
    throw new Error(`Unsupported rename rule: ${rule}`);
  }
}

/** Build a pending rename-files plan for a TV show folder (throws instead of { error }). */
export async function tryToRenameFolderPipeline(
  path: string,
  rule: RenameRuleName | undefined,
  deps: TryToRenameFolderDeps,
): Promise<RenameFilesPlan> {
  const posixPath = deps.normalizePosix(path);
  const createId = deps.createId ?? randomUUID;

  assertSupportedRule(rule);
  const effectiveRule: RenameRuleName = rule ?? "plex";

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

  const files = buildTvShowRenamePlanFileEntries(mediaMetadata, effectiveRule);

  return createRenameEpisodePlanPipeline(
    posixPath,
    files,
    {
      creator: "app",
      allowEmptyFiles: true,
      id: createId(),
    },
    {
      fs: deps.fs,
      appDataDir: deps.appDataDir,
      normalizePosix: deps.normalizePosix,
      getMediaMetadata: async () => mediaMetadata,
      createId,
    },
  );
}
