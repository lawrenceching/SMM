import { requireNonEmptyString } from "@smm/core/ai-tool/toolResult";
import { scrapeFailed, scrapeSucceeded } from "@smm/core/ai-tool/scrapeResult";
import {
  SCRAPE,
  SCRAPE_DESCRIPTION,
  scrapeInputSchema,
  scrapeOutputSchema,
  type ScrapeOutput,
} from "@smm/core/types/ai-tools/scrape";

export interface ScrapeParams {
  path: string;
  language?: string;
}

export type ScrapeFolderRunner = (
  path: string,
  options?: { language?: string },
) => Promise<{ id: string }>;

/**
 * Start a scrape job via host-injected Core runner. No confirmation.
 */
export async function executeScrape(
  params: ScrapeParams,
  runner: ScrapeFolderRunner | undefined,
  abortSignal?: AbortSignal,
): Promise<ScrapeOutput> {
  if (abortSignal?.aborted) {
    throw new Error("Request was aborted");
  }

  const pathCheck = requireNonEmptyString(params.path, "path");
  if (typeof pathCheck !== "string") {
    return scrapeFailed("", pathCheck.error);
  }

  if (!runner) {
    return scrapeFailed(pathCheck, "scrape is not available on this host");
  }

  try {
    const language =
      typeof params.language === "string" && params.language.trim() !== ""
        ? params.language
        : undefined;
    const { id } = await runner(
      pathCheck,
      language !== undefined ? { language } : undefined,
    );
    return scrapeSucceeded(id);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const withPrefix = message.startsWith("Error Reason:")
      ? message
      : `Error Reason: ${message}`;
    return scrapeFailed(pathCheck, withPrefix);
  }
}

/**
 * Build the AI SDK tool for backend chat (`doChat`).
 */
export function buildScrapeTool(
  runner: ScrapeFolderRunner | undefined,
  abortSignal?: AbortSignal,
) {
  return {
    description: SCRAPE_DESCRIPTION,
    inputSchema: scrapeInputSchema,
    outputSchema: scrapeOutputSchema,
    execute: async (args: unknown): Promise<ScrapeOutput> => {
      const params = (args ?? {}) as ScrapeParams;
      return executeScrape(
        {
          path: params.path,
          language: params.language,
        },
        runner,
        abortSignal,
      );
    },
  };
}

export { SCRAPE };
