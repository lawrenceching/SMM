import { requireNonEmptyString } from "@smm/core/ai-tool/toolResult";
import type { TmdbMovieDetails, TmdbSearchResponseBody, TmdbSeriesDetails } from "@smm/core/types";
import {
  formatTmdbToolError,
  toTmdbCoreOptions,
  type TmdbToolHostOptions,
} from "@smm/core/types/ai-tools/tmdbCommon";
import {
  TMDB_SEARCH,
  TMDB_SEARCH_DESCRIPTION,
  tmdbSearchInputSchema,
  tmdbSearchOutputSchema,
  type TmdbSearchInput,
  type TmdbSearchOutput,
} from "@smm/core/types/ai-tools/tmdbSearch";
import {
  TMDB_GET_MOVIE,
  TMDB_GET_MOVIE_DESCRIPTION,
  tmdbGetMovieInputSchema,
  tmdbGetMovieOutputSchema,
  type TmdbGetMovieInput,
  type TmdbGetMovieOutput,
} from "@smm/core/types/ai-tools/tmdbGetMovie";
import {
  TMDB_GET_TV_SHOW,
  TMDB_GET_TV_SHOW_DESCRIPTION,
  tmdbGetTvShowInputSchema,
  tmdbGetTvShowOutputSchema,
  type TmdbGetTvShowInput,
  type TmdbGetTvShowOutput,
} from "@smm/core/types/ai-tools/tmdbGetTvShow";

export type SearchInTmdbRunner = (
  keyword: string,
  options: {
    type: "tv" | "movie";
    language?: string;
    host?: string;
    password?: string;
    proxy?: string;
  },
) => Promise<TmdbSearchResponseBody>;

export type GetMovieInTmdbRunner = (
  id: number,
  options?: { language?: string; host?: string; password?: string; proxy?: string },
) => Promise<TmdbMovieDetails>;

export type GetTvShowInTmdbRunner = (
  id: number,
  options?: { language?: string; host?: string; password?: string; proxy?: string },
) => Promise<TmdbSeriesDetails>;

export interface TmdbToolRunners {
  searchInTmdb?: SearchInTmdbRunner;
  getMovieInTmdb?: GetMovieInTmdbRunner;
  getTvShowInTmdb?: GetTvShowInTmdbRunner;
}

function unavailable(message: string): { error: string } {
  return { error: message };
}

function assertNotAborted(abortSignal?: AbortSignal): void {
  if (abortSignal?.aborted) {
    throw new Error("Request was aborted");
  }
}

export async function executeTmdbSearch(
  params: TmdbSearchInput,
  runner: SearchInTmdbRunner | undefined,
  abortSignal?: AbortSignal,
): Promise<TmdbSearchOutput> {
  assertNotAborted(abortSignal);

  const keywordCheck = requireNonEmptyString(params.keyword, "keyword");
  if (typeof keywordCheck !== "string") {
    return { error: keywordCheck.error };
  }

  if (!runner) {
    return unavailable("tmdb-search is not available on this host");
  }

  try {
    const body = await runner(keywordCheck, {
      type: params.type,
      ...toTmdbCoreOptions(params),
    });
    if (body.error) {
      return { error: body.error };
    }
    return {
      results: body.results,
      page: body.page,
      total_pages: body.total_pages,
      total_results: body.total_results,
    };
  } catch (error) {
    return { error: formatTmdbToolError(error) };
  }
}

export async function executeTmdbGetMovie(
  params: TmdbGetMovieInput,
  runner: GetMovieInTmdbRunner | undefined,
  abortSignal?: AbortSignal,
): Promise<TmdbGetMovieOutput> {
  assertNotAborted(abortSignal);

  if (!Number.isInteger(params.id) || params.id <= 0) {
    return { error: "Invalid id: 'id' must be a positive integer" };
  }

  if (!runner) {
    return unavailable("tmdb-get-movie is not available on this host");
  }

  try {
    const details = await runner(params.id, toTmdbCoreOptions(params));
    return details as TmdbGetMovieOutput;
  } catch (error) {
    return { error: formatTmdbToolError(error) };
  }
}

export async function executeTmdbGetTvShow(
  params: TmdbGetTvShowInput,
  runner: GetTvShowInTmdbRunner | undefined,
  abortSignal?: AbortSignal,
): Promise<TmdbGetTvShowOutput> {
  assertNotAborted(abortSignal);

  if (!Number.isInteger(params.id) || params.id <= 0) {
    return { error: "Invalid id: 'id' must be a positive integer" };
  }

  if (!runner) {
    return unavailable("tmdb-get-tv-show is not available on this host");
  }

  try {
    const details = await runner(params.id, toTmdbCoreOptions(params));
    return details as TmdbGetTvShowOutput;
  } catch (error) {
    return { error: formatTmdbToolError(error) };
  }
}

export function buildTmdbSearchTool(
  runners: TmdbToolRunners | undefined,
  abortSignal?: AbortSignal,
) {
  return {
    description: TMDB_SEARCH_DESCRIPTION,
    inputSchema: tmdbSearchInputSchema,
    outputSchema: tmdbSearchOutputSchema,
    execute: async (args: unknown): Promise<TmdbSearchOutput> => {
      return executeTmdbSearch((args ?? {}) as TmdbSearchInput, runners?.searchInTmdb, abortSignal);
    },
  };
}

export function buildTmdbGetMovieTool(
  runners: TmdbToolRunners | undefined,
  abortSignal?: AbortSignal,
) {
  return {
    description: TMDB_GET_MOVIE_DESCRIPTION,
    inputSchema: tmdbGetMovieInputSchema,
    outputSchema: tmdbGetMovieOutputSchema,
    execute: async (args: unknown): Promise<TmdbGetMovieOutput> => {
      return executeTmdbGetMovie((args ?? {}) as TmdbGetMovieInput, runners?.getMovieInTmdb, abortSignal);
    },
  };
}

export function buildTmdbGetTvShowTool(
  runners: TmdbToolRunners | undefined,
  abortSignal?: AbortSignal,
) {
  return {
    description: TMDB_GET_TV_SHOW_DESCRIPTION,
    inputSchema: tmdbGetTvShowInputSchema,
    outputSchema: tmdbGetTvShowOutputSchema,
    execute: async (args: unknown): Promise<TmdbGetTvShowOutput> => {
      return executeTmdbGetTvShow(
        (args ?? {}) as TmdbGetTvShowInput,
        runners?.getTvShowInTmdb,
        abortSignal,
      );
    },
  };
}

export { TMDB_SEARCH, TMDB_GET_MOVIE, TMDB_GET_TV_SHOW };
