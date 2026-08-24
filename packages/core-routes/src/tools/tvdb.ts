import { requireNonEmptyString } from "@smm/core/ai-tool/toolResult";
import {
  formatTvdbToolError,
  toTvdbCoreOptions,
  type TvdbToolHostOptions,
} from "@smm/core/types/ai-tools/tvdbCommon";
import {
  TVDB_SEARCH,
  TVDB_SEARCH_DESCRIPTION,
  tvdbSearchInputSchema,
  tvdbSearchOutputSchema,
  type TvdbSearchInput,
  type TvdbSearchOutput,
} from "@smm/core/types/ai-tools/tvdbSearch";
import {
  TVDB_GET_MOVIE,
  TVDB_GET_MOVIE_DESCRIPTION,
  tvdbGetMovieInputSchema,
  tvdbGetMovieOutputSchema,
  type TvdbGetMovieInput,
  type TvdbGetMovieOutput,
} from "@smm/core/types/ai-tools/tvdbGetMovie";
import {
  TVDB_GET_TV_SHOW,
  TVDB_GET_TV_SHOW_DESCRIPTION,
  tvdbGetTvShowInputSchema,
  tvdbGetTvShowOutputSchema,
  type TvdbGetTvShowInput,
  type TvdbGetTvShowOutput,
} from "@smm/core/types/ai-tools/tvdbGetTvShow";
import {
  TVDB_GET_LANGUAGES,
  TVDB_GET_LANGUAGES_DESCRIPTION,
  tvdbGetLanguagesInputSchema,
  tvdbGetLanguagesOutputSchema,
  type TvdbGetLanguagesInput,
  type TvdbGetLanguagesOutput,
} from "@smm/core/types/ai-tools/tvdbGetLanguages";

export type SearchInTvdbRunner = (
  keyword: string,
  options: {
    type: "series" | "movie";
    language?: string;
    host?: string;
    password?: string;
    proxy?: string;
  },
) => Promise<Array<Record<string, unknown>>>;

export type GetTvShowInTvdbRunner = (
  id: number,
  options?: { language?: string; host?: string; password?: string; proxy?: string },
) => Promise<Record<string, unknown>>;

export type GetMovieInTvdbRunner = (
  id: number,
  options?: { language?: string; host?: string; password?: string; proxy?: string },
) => Promise<Record<string, unknown>>;

export type GetTvdbLanguagesRunner = (
  options?: { language?: string; host?: string; password?: string; proxy?: string },
) => Promise<Array<Record<string, unknown>>>;

export interface TvdbToolRunners {
  searchInTvdb?: SearchInTvdbRunner;
  getTvShowInTvdb?: GetTvShowInTvdbRunner;
  getMovieInTvdb?: GetMovieInTvdbRunner;
  getTvdbLanguages?: GetTvdbLanguagesRunner;
}

function unavailable(message: string): { error: string } {
  return { error: message };
}

function assertNotAborted(abortSignal?: AbortSignal): void {
  if (abortSignal?.aborted) {
    throw new Error("Request was aborted");
  }
}

export async function executeTvdbSearch(
  params: TvdbSearchInput,
  runner: SearchInTvdbRunner | undefined,
  abortSignal?: AbortSignal,
): Promise<TvdbSearchOutput> {
  assertNotAborted(abortSignal);

  const keywordCheck = requireNonEmptyString(params.keyword, "keyword");
  if (typeof keywordCheck !== "string") {
    return { error: keywordCheck.error };
  }

  if (!runner) {
    return unavailable("tvdb-search is not available on this host");
  }

  try {
    const results = await runner(keywordCheck, {
      type: params.type,
      ...toTvdbCoreOptions(params),
    });
    return { results: results as TvdbSearchOutput["results"] };
  } catch (error) {
    return { error: formatTvdbToolError(error) };
  }
}

export async function executeTvdbGetMovie(
  params: TvdbGetMovieInput,
  runner: GetMovieInTvdbRunner | undefined,
  abortSignal?: AbortSignal,
): Promise<TvdbGetMovieOutput> {
  assertNotAborted(abortSignal);

  if (!Number.isInteger(params.id) || params.id <= 0) {
    return { error: "Invalid id: 'id' must be a positive integer" };
  }

  if (!runner) {
    return unavailable("tvdb-get-movie is not available on this host");
  }

  try {
    const details = await runner(params.id, toTvdbCoreOptions(params));
    return details as TvdbGetMovieOutput;
  } catch (error) {
    return { error: formatTvdbToolError(error) };
  }
}

export async function executeTvdbGetTvShow(
  params: TvdbGetTvShowInput,
  runner: GetTvShowInTvdbRunner | undefined,
  abortSignal?: AbortSignal,
): Promise<TvdbGetTvShowOutput> {
  assertNotAborted(abortSignal);

  if (!Number.isInteger(params.id) || params.id <= 0) {
    return { error: "Invalid id: 'id' must be a positive integer" };
  }

  if (!runner) {
    return unavailable("tvdb-get-tv-show is not available on this host");
  }

  try {
    const details = await runner(params.id, toTvdbCoreOptions(params));
    return details as TvdbGetTvShowOutput;
  } catch (error) {
    return { error: formatTvdbToolError(error) };
  }
}

export async function executeTvdbGetLanguages(
  runner: GetTvdbLanguagesRunner | undefined,
  _params: TvdbGetLanguagesInput = {},
  abortSignal?: AbortSignal,
): Promise<TvdbGetLanguagesOutput> {
  assertNotAborted(abortSignal);

  if (!runner) {
    return unavailable("tvdb-get-languages is not available on this host");
  }

  try {
    const languages = await runner(toTvdbCoreOptions(_params));
    return { languages: languages as TvdbGetLanguagesOutput["languages"] };
  } catch (error) {
    return { error: formatTvdbToolError(error) };
  }
}

export function buildTvdbSearchTool(
  runners: TvdbToolRunners | undefined,
  abortSignal?: AbortSignal,
) {
  return {
    description: TVDB_SEARCH_DESCRIPTION,
    inputSchema: tvdbSearchInputSchema,
    outputSchema: tvdbSearchOutputSchema,
    execute: async (args: unknown): Promise<TvdbSearchOutput> => {
      return executeTvdbSearch((args ?? {}) as TvdbSearchInput, runners?.searchInTvdb, abortSignal);
    },
  };
}

export function buildTvdbGetMovieTool(
  runners: TvdbToolRunners | undefined,
  abortSignal?: AbortSignal,
) {
  return {
    description: TVDB_GET_MOVIE_DESCRIPTION,
    inputSchema: tvdbGetMovieInputSchema,
    outputSchema: tvdbGetMovieOutputSchema,
    execute: async (args: unknown): Promise<TvdbGetMovieOutput> => {
      return executeTvdbGetMovie((args ?? {}) as TvdbGetMovieInput, runners?.getMovieInTvdb, abortSignal);
    },
  };
}

export function buildTvdbGetTvShowTool(
  runners: TvdbToolRunners | undefined,
  abortSignal?: AbortSignal,
) {
  return {
    description: TVDB_GET_TV_SHOW_DESCRIPTION,
    inputSchema: tvdbGetTvShowInputSchema,
    outputSchema: tvdbGetTvShowOutputSchema,
    execute: async (args: unknown): Promise<TvdbGetTvShowOutput> => {
      return executeTvdbGetTvShow(
        (args ?? {}) as TvdbGetTvShowInput,
        runners?.getTvShowInTvdb,
        abortSignal,
      );
    },
  };
}

export function buildTvdbGetLanguagesTool(
  runners: TvdbToolRunners | undefined,
  abortSignal?: AbortSignal,
) {
  return {
    description: TVDB_GET_LANGUAGES_DESCRIPTION,
    inputSchema: tvdbGetLanguagesInputSchema,
    outputSchema: tvdbGetLanguagesOutputSchema,
    execute: async (args: unknown): Promise<TvdbGetLanguagesOutput> => {
      return executeTvdbGetLanguages(runners?.getTvdbLanguages, (args ?? {}) as TvdbGetLanguagesInput, abortSignal);
    },
  };
}

export { TVDB_SEARCH, TVDB_GET_MOVIE, TVDB_GET_TV_SHOW, TVDB_GET_LANGUAGES };
