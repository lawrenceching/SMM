import { z } from 'zod';
import { getMovie } from '@/route/Tmdb';
import type { ToolDefinition } from './types';
import { createSuccessResponse, createErrorResponse } from '@/mcp/tools/mcpToolBase';
import { getLocalizedToolDescription } from '@/i18n/helpers';

interface TmdbGetMovieParams {
  /** TMDB movie ID */
  id: number;
  /** Language code (e.g., 'en-US', 'zh-CN', 'ja-JP') */
  language?: 'zh-CN' | 'en-US' | 'ja-JP';
  /** Custom TMDB base URL (optional) */
  baseURL?: string;
}

/**
 * Get movie details from TMDB by TMDB ID.
 */
async function handleTmdbGetMovie(params: TmdbGetMovieParams): Promise<ReturnType<typeof createSuccessResponse> | ReturnType<typeof createErrorResponse>> {
  const { id, language, baseURL } = params;

  // Validate required parameters
  if (!id || typeof id !== 'number' || id <= 0) {
    return createErrorResponse('Invalid parameter: id is required and must be a positive number');
  }

  try {
    const result = await getMovie(id, language, baseURL);

    if (result.error) {
      return createErrorResponse(result.error);
    }

    return createSuccessResponse(result as unknown as { [x: string]: unknown });
  } catch (error) {
    console.error('[tmdbGetMovie] Error:', error);
    return createErrorResponse(error instanceof Error ? error.message : 'Unknown error occurred while fetching movie from TMDB');
  }
}

export const getTool = async function (clientId?: string): Promise<ToolDefinition> {
  const description = await getLocalizedToolDescription('tmdb-get-movie');

  return {
    toolName: 'tmdb-get-movie',
    description: description,
    inputSchema: z.object({
      id: z.number().describe('TMDB movie ID (positive integer)'),
      language: z.enum(['zh-CN', 'en-US', 'ja-JP']).optional().describe('Language code (e.g., "en-US", "zh-CN", "ja-JP")'),
      baseURL: z.string().optional().describe('Custom TMDB base URL (optional)'),
    }),
    outputSchema: z.object({
      data: z.any().describe('Movie details from TMDB'),
    }),
    execute: async (args: TmdbGetMovieParams) => {
      return handleTmdbGetMovie(args);
    },
  };
}

/**
 * Returns a tool definition with localized description for AI agent usage.
 */
export async function tmdbGetMovieAgentTool(clientId: string) {
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
export async function tmdbGetMovieMcpTool() {
  return getTool();
}
