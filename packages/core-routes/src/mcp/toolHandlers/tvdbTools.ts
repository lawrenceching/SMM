import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  TVDB_SEARCH,
  TVDB_SEARCH_DESCRIPTION,
  tvdbSearchInputSchema,
  tvdbSearchOutputSchema,
} from "@smm/types/ai-tools/tvdbSearch";
import {
  TVDB_GET_MOVIE,
  TVDB_GET_MOVIE_DESCRIPTION,
  tvdbGetMovieInputSchema,
  tvdbGetMovieOutputSchema,
} from "@smm/types/ai-tools/tvdbGetMovie";
import {
  TVDB_GET_TV_SHOW,
  TVDB_GET_TV_SHOW_DESCRIPTION,
  tvdbGetTvShowInputSchema,
  tvdbGetTvShowOutputSchema,
} from "@smm/types/ai-tools/tvdbGetTvShow";
import {
  TVDB_GET_LANGUAGES,
  TVDB_GET_LANGUAGES_DESCRIPTION,
  tvdbGetLanguagesInputSchema,
  tvdbGetLanguagesOutputSchema,
} from "@smm/types/ai-tools/tvdbGetLanguages";
import {
  createErrorResponse,
  createSuccessResponse,
  type McpToolResponse,
} from "../index.ts";
import type { McpConfig } from "../types.ts";
import {
  executeTvdbGetLanguages,
  executeTvdbGetMovie,
  executeTvdbGetTvShow,
  executeTvdbSearch,
} from "../../tools/tvdb.ts";

/**
 * Register TVDB query MCP tools (`tvdb-search`, `tvdb-get-movie`, `tvdb-get-tv-show`, `tvdb-get-languages`).
 */
export function registerTvdbTools(server: McpServer, config: McpConfig): void {
  const searchDescription =
    config.toolDescriptions?.[TVDB_SEARCH] ?? TVDB_SEARCH_DESCRIPTION;
  const movieDescription =
    config.toolDescriptions?.[TVDB_GET_MOVIE] ?? TVDB_GET_MOVIE_DESCRIPTION;
  const tvShowDescription =
    config.toolDescriptions?.[TVDB_GET_TV_SHOW] ?? TVDB_GET_TV_SHOW_DESCRIPTION;
  const languagesDescription =
    config.toolDescriptions?.[TVDB_GET_LANGUAGES] ?? TVDB_GET_LANGUAGES_DESCRIPTION;

  server.registerTool(
    TVDB_SEARCH,
    {
      description: searchDescription,
      inputSchema: tvdbSearchInputSchema,
      outputSchema: tvdbSearchOutputSchema,
    },
    async (args: unknown): Promise<McpToolResponse> => {
      try {
        const result = await executeTvdbSearch(
          (args ?? {}) as Parameters<typeof executeTvdbSearch>[0],
          config.searchInTvdb,
        );
        if (result.error) {
          return createErrorResponse(result.error);
        }
        return createSuccessResponse(result as { [x: string]: unknown });
      } catch (error) {
        return createErrorResponse(error instanceof Error ? error.message : String(error));
      }
    },
  );

  server.registerTool(
    TVDB_GET_MOVIE,
    {
      description: movieDescription,
      inputSchema: tvdbGetMovieInputSchema,
      outputSchema: tvdbGetMovieOutputSchema,
    },
    async (args: unknown): Promise<McpToolResponse> => {
      try {
        const result = await executeTvdbGetMovie(
          (args ?? {}) as Parameters<typeof executeTvdbGetMovie>[0],
          config.getMovieInTvdb,
        );
        if (result.error) {
          return createErrorResponse(result.error);
        }
        return createSuccessResponse(result as { [x: string]: unknown });
      } catch (error) {
        return createErrorResponse(error instanceof Error ? error.message : String(error));
      }
    },
  );

  server.registerTool(
    TVDB_GET_TV_SHOW,
    {
      description: tvShowDescription,
      inputSchema: tvdbGetTvShowInputSchema,
      outputSchema: tvdbGetTvShowOutputSchema,
    },
    async (args: unknown): Promise<McpToolResponse> => {
      try {
        const result = await executeTvdbGetTvShow(
          (args ?? {}) as Parameters<typeof executeTvdbGetTvShow>[0],
          config.getTvShowInTvdb,
        );
        if (result.error) {
          return createErrorResponse(result.error);
        }
        return createSuccessResponse(result as { [x: string]: unknown });
      } catch (error) {
        return createErrorResponse(error instanceof Error ? error.message : String(error));
      }
    },
  );

  server.registerTool(
    TVDB_GET_LANGUAGES,
    {
      description: languagesDescription,
      inputSchema: tvdbGetLanguagesInputSchema,
      outputSchema: tvdbGetLanguagesOutputSchema,
    },
    async (args: unknown): Promise<McpToolResponse> => {
      try {
        const result = await executeTvdbGetLanguages(
          config.getTvdbLanguages,
          (args ?? {}) as Parameters<typeof executeTvdbGetLanguages>[1],
        );
        if (result.error) {
          return createErrorResponse(result.error);
        }
        return createSuccessResponse(result as { [x: string]: unknown });
      } catch (error) {
        return createErrorResponse(error instanceof Error ? error.message : String(error));
      }
    },
  );
}
