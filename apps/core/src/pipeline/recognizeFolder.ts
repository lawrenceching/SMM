import { Path } from "@smm/utils/path";
import type {
  MediaMetadata,
  MovieMediaMetadata,
  PreferMediaLanguage,
  PrimaryDatabase,
  TvShowMediaMetadata,
} from "@smm/types";
import { mapToTvdbLangCode } from "../clients/TvdbClient";
import type { FsPort } from "../ports/FsPort";
import {
  recognizeMediaFolder,
  type RecognitionDeps,
  type RecognitionResult,
  type TmdbRecognitionClient,
  type TvdbRecognitionClient,
} from "./recognizeMediaFolder";
import type { UserConfigHelper } from "./userConfigHelper";
import type { MediaMetadataHelper } from "./mediaMetadataHelper";

export type RecognizeFolderDb = "tmdb" | "tvdb";

export interface RecognizeFolderCandidate {
  db: RecognizeFolderDb;
  id: string;
  title: string;
  year?: string;
  kind: "tvshow" | "movie";
}

export interface RecognizeFolderDeps {
  fs: FsPort;
  appDataDir: string;
  userConfig: UserConfigHelper;
  mediaMetadata: MediaMetadataHelper;
  normalizePosix: (path: string) => string;
  tmdb: TmdbRecognitionClient;
  tvdb: TvdbRecognitionClient;
  language: string;
  primaryDatabase?: PrimaryDatabase;
}

function isManaged(folders: string[], mediaFolderPath: string): boolean {
  const targetPlatform = Path.toPlatformPath(mediaFolderPath);
  const targetPosix = Path.posix(mediaFolderPath);
  return folders.some(
    (folder) =>
      Path.toPlatformPath(folder) === targetPlatform || Path.posix(folder) === targetPosix,
  );
}

async function loadManagedMediaMetadata(
  path: string,
  deps: RecognizeFolderDeps,
): Promise<{ posixPath: string; mm: MediaMetadata }> {
  const posixPath = deps.normalizePosix(path);
  const config = await deps.userConfig.read();
  if (!isManaged(config.folders ?? [], path)) {
    throw new Error(`${posixPath} is not managed by SMM`);
  }
  const mm = await deps.mediaMetadata.read(posixPath);
  if (!mm) {
    throw new Error(`Media metadata not found: ${path}`);
  }
  if (mm.type !== "tvshow-folder" && mm.type !== "movie-folder") {
    throw new Error(`Folder type cannot be recognized: ${mm.type ?? "unknown"}`);
  }
  return { posixPath, mm: { ...mm, mediaFolderPath: posixPath } };
}

function yearFromAirDate(airDate?: string): string | undefined {
  if (!airDate || airDate.length < 4) return undefined;
  return airDate.slice(0, 4);
}

function dbFromDatabase(database: "TMDB" | "TVDB"): RecognizeFolderDb {
  return database === "TMDB" ? "tmdb" : "tvdb";
}

function candidateFromHit(
  tvShow: TvShowMediaMetadata | undefined,
  movie: MovieMediaMetadata | undefined,
): RecognizeFolderCandidate {
  if (tvShow) {
    return {
      db: dbFromDatabase(tvShow.database),
      id: tvShow.id,
      title: tvShow.name,
      year: yearFromAirDate(tvShow.airDate),
      kind: "tvshow",
    };
  }
  if (movie) {
    return {
      db: dbFromDatabase(movie.database),
      id: movie.id,
      title: movie.name,
      year: yearFromAirDate(movie.airDate),
      kind: "movie",
    };
  }
  throw new Error("Unable to recognize folder");
}

function recognitionDepsOf(deps: RecognizeFolderDeps): RecognitionDeps {
  return {
    fs: deps.fs,
    tmdb: deps.tmdb,
    tvdb: deps.tvdb,
    language: deps.language,
    primaryDatabase: deps.primaryDatabase,
  };
}

/**
 * Writes a recognition hit into the metadata cache. `mediaFiles` is reset because
 * the file/episode links of the previous title no longer apply.
 */
async function persistRecognition(
  posixPath: string,
  type: MediaMetadata["type"],
  hit: { tvShow?: TvShowMediaMetadata; movie?: MovieMediaMetadata },
  deps: RecognizeFolderDeps,
): Promise<void> {
  const next: MediaMetadata = {
    mediaFolderPath: posixPath,
    type,
    mediaFiles: [],
    ...(hit.tvShow !== undefined ? { tvShow: hit.tvShow } : {}),
    ...(hit.movie !== undefined ? { movie: hit.movie } : {}),
  };
  await deps.mediaMetadata.write(next);
}

export async function tryToRecognizeFolderPipeline(
  path: string,
  deps: RecognizeFolderDeps,
): Promise<RecognizeFolderCandidate> {
  const { mm } = await loadManagedMediaMetadata(path, deps);
  const result = await recognizeMediaFolder(mm, recognitionDepsOf(deps));
  if (result.tvShow === undefined && result.movie === undefined) {
    throw new Error(`Unable to recognize folder: ${path}`);
  }
  return candidateFromHit(result.tvShow, result.movie);
}

/**
 * Rule-based recognition (NFO → id in folder name → search) followed by a metadata
 * write. Unlike {@link tryToRecognizeFolderPipeline} it persists the hit directly and
 * leaves metadata untouched when nothing is recognized, as folder initialization needs.
 */
export async function autoRecognizeFolderPipeline(
  path: string,
  deps: RecognizeFolderDeps,
  filePaths?: string[],
): Promise<RecognitionResult> {
  const { posixPath, mm } = await loadManagedMediaMetadata(path, deps);
  const result = await recognizeMediaFolder(mm, recognitionDepsOf(deps), filePaths);
  if (result.tvShow === undefined && result.movie === undefined) {
    return result;
  }
  await persistRecognition(posixPath, mm.type, result, deps);
  return result;
}

export async function recognizeFolderPipeline(
  path: string,
  options: { db: RecognizeFolderDb; id: string },
  deps: RecognizeFolderDeps,
): Promise<void> {
  const { posixPath, mm } = await loadManagedMediaMetadata(path, deps);
  const idNum = Number(options.id);
  if (!Number.isInteger(idNum) || idNum <= 0) {
    throw new Error("id must be a positive integer");
  }
  const isTv = mm.type === "tvshow-folder";
  let tvShow: TvShowMediaMetadata | undefined;
  let movie: MovieMediaMetadata | undefined;

  if (options.db === "tmdb") {
    if (isTv) {
      tvShow = await deps.tmdb.getTvShowMediaMetadata(idNum, deps.language);
    } else {
      movie = await deps.tmdb.getMovieMediaMetadata(idNum, deps.language);
    }
  } else {
    const tvdbLang = mapToTvdbLangCode(deps.language as PreferMediaLanguage);
    if (isTv) {
      tvShow = await deps.tvdb.getTvShowMediaMetadata(idNum, tvdbLang);
    } else {
      movie = await deps.tvdb.getMovieMediaMetadata(idNum, tvdbLang);
    }
  }

  if (isTv) {
    if (!tvShow) throw new Error(`Failed to fetch ${options.db} TV show ${options.id}`);
  } else if (!movie) {
    throw new Error(`Failed to fetch ${options.db} movie ${options.id}`);
  }

  await persistRecognition(posixPath, mm.type, isTv ? { tvShow } : { movie }, deps);
}
