import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  GET_JOB,
  GET_JOB_DESCRIPTION,
  getJobInputSchema,
  getJobOutputSchema,
} from "@smm/types/ai-tools/getJob";
import {
  createErrorResponse,
  createSuccessResponse,
  type McpToolResponse,
} from "../index.ts";
import type { McpConfig } from "../types.ts";
import { executeGetJob } from "../../tools/getJob.ts";

/**
 * Register the `get-job` MCP tool.
 * Returns scrape or import job status by id via Core.
 */
export function registerGetJobTool(
  server: McpServer,
  config: McpConfig,
): void {
  const description =
    config.toolDescriptions?.[GET_JOB] ?? GET_JOB_DESCRIPTION;

  server.registerTool(
    GET_JOB,
    {
      description,
      inputSchema: getJobInputSchema,
      outputSchema: getJobOutputSchema,
    },
    async (args: unknown): Promise<McpToolResponse> => {
      const params = (args ?? {}) as { id?: string };
      if (typeof params.id !== "string" || params.id.trim() === "") {
        return createErrorResponse(
          "Invalid id: 'id' must be a non-empty string",
        );
      }

      try {
        const result = await executeGetJob(params.id, config.getJob);

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
