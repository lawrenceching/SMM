import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  SCRAPE,
  SCRAPE_DESCRIPTION,
  scrapeInputSchema,
  scrapeOutputSchema,
} from "@smm/core/types/ai-tools/scrape";
import {
  createErrorResponse,
  createSuccessResponse,
  type McpToolResponse,
} from "../index.ts";
import type { McpConfig } from "../types.ts";
import { executeScrape } from "../../tools/scrape.ts";

/**
 * Register the `scrape` MCP tool.
 * Starts a Core scrape job (no confirmation) and returns `{ id, message }`.
 */
export function registerScrapeTool(
  server: McpServer,
  config: McpConfig,
): void {
  const description =
    config.toolDescriptions?.[SCRAPE] ?? SCRAPE_DESCRIPTION;

  server.registerTool(
    SCRAPE,
    {
      description,
      inputSchema: scrapeInputSchema,
      outputSchema: scrapeOutputSchema,
    },
    async (args: unknown): Promise<McpToolResponse> => {
      const params = (args ?? {}) as { path?: string; language?: string };
      if (typeof params.path !== "string" || params.path.trim() === "") {
        return createErrorResponse(
          "Invalid path: 'path' must be a non-empty string",
        );
      }

      try {
        const result = await executeScrape(
          {
            path: params.path,
            language: params.language,
          },
          config.scrapeFolder,
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
