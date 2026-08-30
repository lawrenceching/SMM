import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  TMDB_SEARCH,
  TMDB_SEARCH_DESCRIPTION,
  tmdbSearchInputSchema,
  tmdbSearchOutputSchema,
} from "@smm/types/ai-tools/tmdbSearch";
import {
  TMDB_GET_MOVIE,
  TMDB_GET_MOVIE_DESCRIPTION,
  tmdbGetMovieInputSchema,
  tmdbGetMovieOutputSchema,
} from "@smm/types/ai-tools/tmdbGetMovie";
import {
  TMDB_GET_TV_SHOW,
  TMDB_GET_TV_SHOW_DESCRIPTION,
  tmdbGetTvShowInputSchema,
  tmdbGetTvShowOutputSchema,
} from "@smm/types/ai-tools/tmdbGetTvShow";
import {
  createErrorResponse,
  createSuccessResponse,
  type McpToolResponse,
} from "../index.ts";
import type { McpConfig } from "../types.ts";
import {
  executeTmdbGetMovie,
  executeTmdbGetTvShow,
  executeTmdbSearch,
} from "../../tools/tmdb.ts";

/**
 * Register TMDB query MCP tools (`tmdb-search`, `tmdb-get-movie`, `tmdb-get-tv-show`).
 */
export function registerTmdbTools(server: McpServer, config: McpConfig): void {
  const searchDescription =
    config.toolDescriptions?.[TMDB_SEARCH] ?? TMDB_SEARCH_DESCRIPTION;
  const movieDescription =
    config.toolDescriptions?.[TMDB_GET_MOVIE] ?? TMDB_GET_MOVIE_DESCRIPTION;
  const tvShowDescription =
    config.toolDescriptions?.[TMDB_GET_TV_SHOW] ?? TMDB_GET_TV_SHOW_DESCRIPTION;

  server.registerTool(
    TMDB_SEARCH,
    {
      description: searchDescription,
      inputSchema: tmdbSearchInputSchema,
      outputSchema: tmdbSearchOutputSchema,
    },
    async (args: unknown): Promise<McpToolResponse> => {
      try {
        const result = await executeTmdbSearch(
          (args ?? {}) as Parameters<typeof executeTmdbSearch>[0],
          config.searchInTmdb,
        );
        if (result.error) {
          return createErrorResponse(result.error);
        }
        return createSuccessResponse(result as { [x: string]: unknown });
      } catch (error) {
        return createErrorResponse(
          error instanceof Error ? error.message : String(error),
        );
      }
    },
  );

  server.registerTool(
    TMDB_GET_MOVIE,
    {
      description: movieDescription,
      inputSchema: tmdbGetMovieInputSchema,
      outputSchema: tmdbGetMovieOutputSchema,
    },
    async (args: unknown): Promise<McpToolResponse> => {
      try {
        const result = await executeTmdbGetMovie(
          (args ?? {}) as Parameters<typeof executeTmdbGetMovie>[0],
          config.getMovieInTmdb,
        );
        if (result.error) {
          return createErrorResponse(result.error);
        }
        return createSuccessResponse(result as { [x: string]: unknown });
      } catch (error) {
        return createErrorResponse(
          error instanceof Error ? error.message : String(error),
        );
      }
    },
  );

  server.registerTool(
    TMDB_GET_TV_SHOW,
    {
      description: tvShowDescription,
      inputSchema: tmdbGetTvShowInputSchema,
      outputSchema: tmdbGetTvShowOutputSchema,
    },
    async (args: unknown): Promise<McpToolResponse> => {
      try {
        const result = await executeTmdbGetTvShow(
          (args ?? {}) as Parameters<typeof executeTmdbGetTvShow>[0],
          config.getTvShowInTmdb,
        );
        if (result.error) {
          return createErrorResponse(result.error);
        }
        return createSuccessResponse(result as { [x: string]: unknown });
      } catch (error) {
        return createErrorResponse(
          error instanceof Error ? error.message : String(error),
        );
      }
    },
  );
}
