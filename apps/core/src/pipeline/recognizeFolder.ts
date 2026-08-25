import { Path } from "@core/path";
import type {
  MediaMetadata,
  MovieMediaMetadata,
  PreferMediaLanguage,
  PrimaryDatabase,
  TvShowMediaMetadata,
} from "@smm/core";
import { mapToTvdbLangCode } from "../clients/TvdbClient";
import type { FsPort } from "../ports/FsPort";
import {
  recognizeMediaFolder,
  type RecognitionDeps,
  type TmdbRecognitionClient,
  type TvdbRecognitionClient,
} from "./recognizeMediaFolder";
import { metadataCachePath } from "./paths";
import type { UserConfig } from "./userConfig";

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
  userConfig: UserConfig;
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
  const cachePath = metadataCachePath(deps.appDataDir, posixPath);
  if (!(await deps.fs.exists(cachePath))) {
    throw new Error(`Media metadata not found: ${path}`);
  }
  let mm: MediaMetadata;
  try {
    mm = JSON.parse(await deps.fs.readTextFile(cachePath)) as MediaMetadata;
  } catch {
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

export async function tryToRecognizeFolderPipeline(
  path: string,
  deps: RecognizeFolderDeps,
): Promise<RecognizeFolderCandidate> {
  const { mm } = await loadManagedMediaMetadata(path, deps);
  const recognitionDeps: RecognitionDeps = {
    fs: deps.fs,
    tmdb: deps.tmdb,
    tvdb: deps.tvdb,
    language: deps.language,
    primaryDatabase: deps.primaryDatabase,
  };
  const result = await recognizeMediaFolder(mm, recognitionDeps);
  if (result.tvShow === undefined && result.movie === undefined) {
    throw new Error(`Unable to recognize folder: ${path}`);
  }
  return candidateFromHit(result.tvShow, result.movie);
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

  const next: MediaMetadata = {
    mediaFolderPath: posixPath,
    type: mm.type,
    mediaFiles: [],
    ...(isTv ? { tvShow } : { movie }),
  };
  await deps.fs.writeTextFile(
    metadataCachePath(deps.appDataDir, posixPath),
    JSON.stringify(next, null, 2),
  );
}
