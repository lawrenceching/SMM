import { z } from 'zod';
import type { NewFileNameRequestBody, GetFileNameResponseBody } from '@core/types';
import { generateFileNameByJavaScript, plex } from '../utils/renameRules';
import pino from 'pino';

const logger = pino();

const newFileNameRequestSchema = z.object({
  ruleName: z.enum(['plex'], { message: 'ruleName must be "plex"' }),
  type: z.enum(['tv', 'movie'], { message: 'type must be "tv" or "movie"' }),
  seasonNumber: z.number().int().min(0, 'seasonNumber must be a non-negative integer'),
  episodeNumber: z.number().int().min(0, 'episodeNumber must be a non-negative integer'),
  episodeName: z.string().min(1, 'episodeName is required'),
  tvshowName: z.string().min(1, 'tvshowName is required'),
  file: z.string().min(1, 'file path is required'),
  tmdbId: z.string().min(1, 'tmdbId is required'),
  releaseYear: z.string(),
});

export async function handleNewFileName(body: NewFileNameRequestBody): Promise<GetFileNameResponseBody> {
  try {
    // Validate request body
    const validationResult = newFileNameRequestSchema.safeParse(body);
    
    if (!validationResult.success) {
      logger.warn({
        errors: validationResult.error.issues.map(i => i.message),
        body
      }, '[handleNewFileName] Validation failed');
      return {
        data: '',
        error: `Validation Failed: ${validationResult.error.issues.map(i => i.message).join(', ')}`,
      };
    }

    const { ruleName, type, seasonNumber, episodeNumber, episodeName, tvshowName, file, tmdbId, releaseYear } = validationResult.data;

    // Get the rename rule code based on ruleName
    let renameRuleCode: string;
    if (ruleName === 'plex') {
      renameRuleCode = plex;
    } else {
      logger.warn({
        ruleName
      }, '[handleNewFileName] Unsupported ruleName');
      return {
        data: '',
        error: `Unsupported Rule: ruleName "${ruleName}" is not supported`,
      };
    }

    // Generate the new file name using the JavaScript code
    try {
      const newFileName = generateFileNameByJavaScript(renameRuleCode, {
        type,
        seasonNumber,
        episodeNumber,
        episodeName,
        tvshowName,
        file,
        tmdbId,
        releaseYear,
      });

      logger.info({
        ruleName,
        type,
        seasonNumber,
        episodeNumber,
        newFileName
      }, '[handleNewFileName] Successfully generated new file name');

      return {
        data: newFileName,
      };
    } catch (error) {
      logger.error({
        ruleName,
        type,
        seasonNumber,
        episodeNumber,
        error: error instanceof Error ? error.message : String(error)
      }, '[handleNewFileName] Failed to generate file name');
      return {
        data: '',
        error: `Generation Failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  } catch (error) {
    logger.error({
      error: error instanceof Error ? error.message : String(error)
    }, '[handleNewFileName] Unexpected error');
    return {
      data: '',
      error: `Unexpected Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

