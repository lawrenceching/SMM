import { z } from 'zod';
import { search } from '@/route/Tmdb';
import type { ToolDefinition } from './types';
import { createSuccessResponse, createErrorResponse } from '@/mcp/tools/mcpToolBase';
import { getLocalizedToolDescription } from '@/i18n/helpers';

interface TmdbSearchParams {
  /** Search keyword */
  keyword: string;
  /** Media type: 'movie' or 'tv' */
  type: 'movie' | 'tv';
  /** Language code (e.g., 'en-US', 'zh-CN', 'ja-JP') */
  language?: 'zh-CN' | 'en-US' | 'ja-JP';
  /** Custom TMDB base URL (optional) */
  baseURL?: string;
}

/**
 * Search TMDB for movies or TV shows by keyword.
 */
async function handleTmdbSearch(params: TmdbSearchParams): Promise<ReturnType<typeof createSuccessResponse> | ReturnType<typeof createErrorResponse>> {
  const { keyword, type, language, baseURL } = params;

  // Validate required parameters
  if (!keyword || typeof keyword !== 'string' || keyword.trim() === '') {
    return createErrorResponse('Invalid parameter: keyword is required and must be a non-empty string');
  }

  if (type !== 'movie' && type !== 'tv') {
    return createErrorResponse('Invalid parameter: type must be either "movie" or "tv"');
  }

  try {
    const result = await search({ keyword, type, language, baseURL });

    if (result.error) {
      return createErrorResponse(result.error);
    }

    return createSuccessResponse(result);
  } catch (error) {
    console.error('[tmdbSearch] Error:', error);
    return createErrorResponse(error instanceof Error ? error.message : 'Unknown error occurred while searching TMDB');
  }
}

export const getTool = async function (clientId?: string): Promise<ToolDefinition> {
  const description = await getLocalizedToolDescription('tmdb-search');

  return {
    toolName: 'tmdb-search',
    description: description,
    inputSchema: z.object({
      keyword: z.string().describe('Search keyword for movie or TV show'),
      type: z.enum(['movie', 'tv']).describe('Media type to search for: "movie" or "tv"'),
      language: z.enum(['zh-CN', 'en-US', 'ja-JP']).optional().describe('Language code (e.g., "en-US", "zh-CN", "ja-JP")'),
      baseURL: z.string().optional().describe('Custom TMDB base URL (optional)'),
    }),
    outputSchema: z.object({
      results: z.array(z.any()).describe('Array of search results'),
      page: z.number().describe('Current page number'),
      total_pages: z.number().describe('Total number of pages'),
      total_results: z.number().describe('Total number of results'),
    }),
    execute: async (args: TmdbSearchParams) => {
      return handleTmdbSearch(args);
    },
  };
}

/**
 * Returns a tool definition with localized description for AI agent usage.
 */
export async function tmdbSearchAgentTool(clientId: string) {
  const tool = await getTool(clientId);
  return {
    description: tool.description,
    inputSchema: tool.inputSchema,
    outputSchema: tool.outputSchema,
    execute: (args: any) => tool.execute(args),
  };
}

/**
 * Returns a tool definition with localized description for MCP server usage.
 */
export async function tmdbSearchMcpTool() {
  return getTool();
}
