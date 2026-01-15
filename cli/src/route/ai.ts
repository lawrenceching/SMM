import { generateObject } from 'ai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { z } from 'zod/v3';
import type { OpenAIGenerateObjectRequestBody, OpenAIGenerateObjectResponseBody, OpenAICompatibleConfig, TMDBTVShowDetails } from '@core/types';
import type { Hono } from "hono";

interface MatchMediaFilesToEpisodeResponse {
  data: {
    seasonNumber: number;
    episodeNumber: number;
    filePath: string;
  }[];
}


const schema = z.object({
  data: z.array(
    z.object({
      seasonNumber: z.number().int().positive().describe('The season number (1-based)'),
      episodeNumber: z.number().int().positive().describe('The episode number within the season (1-based)'),
      filePath: z.string().describe('The absolute file path to the media file (in POSIX format)'),
    })
  ).describe('Array of matched media files with their corresponding season and episode numbers'),
});

export async function matchMediaFilesToEpisode(config: OpenAICompatibleConfig, prompt: string): Promise<MatchMediaFilesToEpisodeResponse> {
  // Validate required config values
  if (!config.baseURL) {
    throw new Error('baseURL is required in OpenAICompatibleConfig');
  }
  if (!config.apiKey) {
    throw new Error('apiKey is required in OpenAICompatibleConfig');
  }
  if(!config.model) {
    throw new Error('model is required in OpenAICompatibleConfig');
  }

  // Type narrowing: after validation, we know these are strings
  const baseURL: string = config.baseURL;
  const apiKey: string = config.apiKey;

  // Create OpenAI-compatible provider from config
  const provider = createOpenAICompatible({
    name: 'Custom',
    baseURL: baseURL,
    apiKey: apiKey,
  });

  console.log(`start to generate object`);
  const { object } = await generateObject({
    model: provider(config.model),
    schema: schema,
    prompt: prompt,
  });
  console.log(`generated object: ${JSON.stringify(object)}`);
  return object as MatchMediaFilesToEpisodeResponse;
}

export async function handleMatchMediaFilesToEpisodeRequest(app: Hono) {
    /**
     * TODO:
     * I got error:
     * AI SDK Warning: The "responseFormat" setting is not supported by this model - JSON response format schema is only supported with structuredOutputs
     * 
     * Need further investigation to for what model can support JSON response format schema.
     * hold this API for now.
     */
    app.post('/api/ai/matchMediaFilesToEpisode', async (c) => {
        console.log(`[HTTP_IN] ${c.req.method} ${c.req.url}`);
        const body = await c.req.json() as OpenAIGenerateObjectRequestBody;
        const config: OpenAICompatibleConfig = {
            baseURL: body.baseURL,
            apiKey: body.apiKey,
            model: body.model,
        };

        const object = await matchMediaFilesToEpisode(config, body.prompt);
        const response: OpenAIGenerateObjectResponseBody = {
            data: object,
        };
        return c.json(response);
    });
}