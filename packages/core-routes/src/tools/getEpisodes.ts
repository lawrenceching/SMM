import {
  GET_EPISODES,
  GET_EPISODES_DESCRIPTION,
  getEpisodesInputSchema,
  getEpisodesToolOutputSchema,
} from "@smm/core/types/ai-tools/getEpisodes";
import { doGetEpisodes } from "../getEpisodes.ts";
import type { CoreRoutesConfig } from "../types.ts";

/**
 * Build the AI SDK `streamText` tool object for `GET_EPISODES`. The
 * underlying `doGetEpisodes` reads media metadata from the cache, so
 * the tool takes a `CoreRoutesConfig` snapshot for appDataDir /
 * allowlist resolution.
 */
export function buildGetEpisodesTool(
  config: CoreRoutesConfig,
  abortSignal?: AbortSignal,
) {
  return {
    description: GET_EPISODES_DESCRIPTION,
    inputSchema: getEpisodesInputSchema,
    outputSchema: getEpisodesToolOutputSchema,
    execute: async (args: unknown) => {
      if (abortSignal?.aborted) {
        throw new Error("Request was aborted");
      }
      const params = (args ?? {}) as { mediaFolderPath?: string };
      return doGetEpisodes({ mediaFolderPath: params.mediaFolderPath ?? "" }, config);
    },
  };
}

/** Re-exported tool name constant for the tools registry. */
export const GET_EPISODES_TOOL_NAME = GET_EPISODES;
