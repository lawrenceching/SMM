import { z } from 'zod/v3';
import { logger } from '../../../lib/logger';
import { createGetEpisodesTool } from '../../tools';
import type { Hono } from 'hono';

interface EpisodeItem {
  season: number;
  episode: number;
  videoFilePath?: string;
}

interface GetEpisodesToolData {
  episodes: EpisodeItem[];
  totalCount: number;
  showName: string;
  numberOfSeasons: number;
}

interface DebugGetEpisodesToolResponseBody {
  success: boolean;
  data?: GetEpisodesToolData;
  error?: string;
}

const getEpisodesToolSchema = z.object({
  mediaFolderPath: z.string().min(1, 'Media folder path is required'),
  clientId: z.string().optional(),
});

export async function processGetEpisodesTool(body: unknown): Promise<DebugGetEpisodesToolResponseBody> {
  try {
    const validationResult = getEpisodesToolSchema.safeParse(body ?? {});
    if (!validationResult.success) {
      return {
        success: false,
        error: `Validation failed: ${validationResult.error.issues.map(i => i.message).join(', ')}`,
      };
    }

    const { mediaFolderPath, clientId = '' } = validationResult.data;
    const tool = createGetEpisodesTool(clientId, undefined);
    const result = await tool.execute({ mediaFolderPath });

    if (!result || typeof result !== 'object' || !('episodes' in result)) {
      return {
        success: false,
        error: 'Invalid getEpisodes tool response',
      };
    }

    const data = result as GetEpisodesToolData & { message?: string };
    const hasError = typeof data.message === 'string' && data.message.length > 0;

    return {
      success: !hasError,
      data: {
        episodes: data.episodes ?? [],
        totalCount: data.totalCount ?? 0,
        showName: data.showName ?? '',
        numberOfSeasons: data.numberOfSeasons ?? 0,
      },
      error: hasError ? data.message : undefined,
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to execute getEpisodes tool: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

export function handleDebugGetEpisodesToolRoute(app: Hono) {
  app.post('/debug/getEpisodesTool', async (c) => {
    try {
      const rawBody = await c.req.json();
      const result = await processGetEpisodesTool(rawBody);
      return c.json(result, 200);
    } catch (error) {
      logger.error({ error }, 'Debug API getEpisodesTool route error:');
      return c.json({
        success: false,
        error: `Failed to process getEpisodesTool request: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }, 500);
    }
  });
}
