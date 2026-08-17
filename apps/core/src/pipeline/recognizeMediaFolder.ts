import type {
  MediaMetadata,
  MovieMediaMetadata,
  PrimaryDatabase,
  TMDBMovie,
  TMDBTVShow,
  TvShowMediaMetadata,
} from "@smm/core";
import type { TVDBv4SearchResult } from "@smm/tvdb4";
import type { TmdbClient } from "../clients/TmdbClient";
import { movieMediaMetadataFromTmdbSearch } from "../clients/TmdbClient";
import type { TvdbClient } from "../clients/TvdbClient";
import type { FsPort } from "../ports/FsPort";
import { parseNfo } from "./nfo";
import { basename } from "./paths";

export interface RecognitionDeps {
  fs: FsPort;
  tmdb: TmdbClient;
  tvdb: TvdbClient;
  language: string;
  primaryDatabase?: PrimaryDatabase;
}

export interface RecognitionResult {
  tvShow?: TvShowMediaMetadata;
  movie?: MovieMediaMetadata;
}

const TMDB_ID_IN_FOLDER_RE = /(?:[[({])\s*tmdbid\s*=\s*(\d+)\s*[\])}]/i;
const TVDB_ID_IN_FOLDER_RE = /(?:[[({])\s*tvdbid\s*=\s*(\d+)\s*[\])}]/i;

export function getTmdbIdFromFolderName(folderName: string): string | null {
  const match = folderName.match(TMDB_ID_IN_FOLDER_RE);
  return match === null ? null : match[1]!;
}

export function getTvdbIdFromFolderName(folderName: string): string | null {
  const match = folderName.match(TVDB_ID_IN_FOLDER_RE);
  return match === null ? null : match[1]!;
}

export function resolveTvdbSeriesId(item: TVDBv4SearchResult): number | undefined {
  const oid = item.objectID ?? item.id;
  if (oid.startsWith("series-")) {
    const n = parseInt(oid.slice("series-".length), 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  const raw = item.tvdb_id;
  if (raw !== undefined) {
    const n = parseInt(String(raw), 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return undefined;
}

export function resolveTvdbMovieId(item: TVDBv4SearchResult): number | undefined {
  const oid = item.objectID ?? item.id;
  if (/^movie-/i.test(oid)) {
    const n = parseInt(oid.replace(/^movie-/i, ""), 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  const raw = item.tvdb_id;
  if (raw !== undefined) {
    const n = parseInt(String(raw), 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return undefined;
}

function folderNameOf(mm: MediaMetadata): string {
  return basename(mm.mediaFolderPath ?? "");
}

async function recognizeByNfo(
  mm: MediaMetadata,
  deps: RecognitionDeps,
  result: RecognitionResult,
  isTvShow: boolean,
): Promise<void> {
  const nfoName = isTvShow ? "tvshow.nfo" : "movie.nfo";
  const nfoPath = (mm.files ?? []).find((f) => f.endsWith(`/${nfoName}`));
  if (nfoPath === undefined) return;

  let xml: string;
  try {
    xml = await deps.fs.readTextFile(nfoPath);
  } catch {
    return;
  }
  const nfo = parseNfo(xml);

  if (nfo.tmdbid !== undefined) {
    const n = parseInt(nfo.tmdbid, 10);
    if (n > 0) {
      if (isTvShow) {
        const tvShow = await deps.tmdb.getTvShowMediaMetadata(n, deps.language);
        if (tvShow !== undefined) result.tvShow = tvShow;
      } else {
        const movie = await deps.tmdb.getMovieMediaMetadata(n, deps.language);
        if (movie !== undefined) result.movie = movie;
      }
    }
    return;
  }

  if (nfo.tvdbid !== undefined) {
    const n = parseInt(nfo.tvdbid, 10);
    if (n > 0) {
      if (isTvShow) {
        const tvShow = await deps.tvdb.getTvShowMediaMetadata(n, deps.language);
        if (tvShow !== undefined) result.tvShow = tvShow;
      } else {
        const movie = await deps.tvdb.getMovieMediaMetadata(n, deps.language);
        if (movie !== undefined) result.movie = movie;
      }
    }
  }
}

async function searchInTmdb(
  folderName: string,
  isTvShow: boolean,
  deps: RecognitionDeps,
  result: RecognitionResult,
): Promise<void> {
  try {
    if (isTvShow) {
      const body = await deps.tmdb.search(folderName, "tv", deps.language);
      const first = body.results[0] as TMDBTVShow | undefined;
      if (first !== undefined) {
        const tvShow = await deps.tmdb.getTvShowMediaMetadata(first.id, deps.language);
        if (tvShow !== undefined) result.tvShow = tvShow;
      }
    } else {
      const body = await deps.tmdb.search(folderName, "movie", deps.language);
      for (const item of body.results) {
        const movie = item as TMDBMovie;
        if (movie.title === folderName) {
          result.movie = movieMediaMetadataFromTmdbSearch(movie);
          return;
        }
      }
    }
  } catch {
    // recognition is best-effort; fall through to the next phase
  }
}

async function searchInTvdb(
  folderName: string,
  isTvShow: boolean,
  deps: RecognitionDeps,
  result: RecognitionResult,
): Promise<void> {
  try {
    if (isTvShow) {
      const items = await deps.tvdb.searchSeries(folderName, deps.language);
      for (const item of items ?? []) {
        const id = resolveTvdbSeriesId(item);
        if (id === undefined) continue;
        const tvShow = await deps.tvdb.getTvShowMediaMetadata(id, deps.language);
        if (tvShow !== undefined) {
          result.tvShow = tvShow;
          return;
        }
      }
    } else {
      const items = await deps.tvdb.searchMovie(folderName, deps.language);
      for (const item of items ?? []) {
        if (item.name === folderName) {
          const id = resolveTvdbMovieId(item);
          if (id === undefined) continue;
          const movie = await deps.tvdb.getMovieMediaMetadata(id, deps.language);
          if (movie !== undefined) {
            result.movie = movie;
            return;
          }
        }
      }
    }
  } catch {
    // best-effort
  }
}

/**
 * Mirrors `recognizeMediaFolder` in `apps/ui/src/lib/recognizeMediaFolder.ts`:
 * NFO → tmdbid in folder name → tvdbid in folder name → search by folder name
 * (ordered by primaryDatabase). Only reached for tvshow / movie folders.
 */
export async function recognizeMediaFolder(mm: MediaMetadata, deps: RecognitionDeps): Promise<RecognitionResult> {
  const result: RecognitionResult = {};
  const folderName = folderNameOf(mm);
  const isTvShow = mm.type === "tvshow-folder";

  await recognizeByNfo(mm, deps, result, isTvShow);

  const tmdbId = getTmdbIdFromFolderName(folderName);
  if (tmdbId !== null && result.tvShow === undefined && result.movie === undefined) {
    const n = parseInt(tmdbId, 10);
    if (n > 0) {
      if (isTvShow) {
        const tvShow = await deps.tmdb.getTvShowMediaMetadata(n, deps.language);
        if (tvShow !== undefined) result.tvShow = tvShow;
      } else {
        const movie = await deps.tmdb.getMovieMediaMetadata(n, deps.language);
        if (movie !== undefined) result.movie = movie;
      }
    }
  }

  const tvdbId = getTvdbIdFromFolderName(folderName);
  if (tvdbId !== null && result.tvShow === undefined && result.movie === undefined) {
    const n = parseInt(tvdbId, 10);
    if (n > 0) {
      if (isTvShow) {
        const tvShow = await deps.tvdb.getTvShowMediaMetadata(n, deps.language);
        if (tvShow !== undefined) result.tvShow = tvShow;
      } else {
        const movie = await deps.tvdb.getMovieMediaMetadata(n, deps.language);
        if (movie !== undefined) result.movie = movie;
      }
    }
  }

  const order: Array<"TMDB" | "TVDB"> = deps.primaryDatabase === "TVDB" ? ["TVDB", "TMDB"] : ["TMDB", "TVDB"];
  for (const db of order) {
    if (result.tvShow !== undefined || result.movie !== undefined) break;
    if (db === "TMDB") await searchInTmdb(folderName, isTvShow, deps, result);
    else await searchInTvdb(folderName, isTvShow, deps, result);
  }

  return result;
}
