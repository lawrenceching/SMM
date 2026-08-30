import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  CREATE_RENAME_EPISODE_PLAN,
  CREATE_RENAME_EPISODE_PLAN_DESCRIPTION,
  createRenameEpisodePlanInputSchema,
} from "@smm/types/ai-tools/createRenameEpisodePlan";
import { defaultChatFs } from "../../chatFs.ts";
import { buildCreateRenameEpisodePlanTool } from "../../tools/createRenameEpisodePlan.ts";
import {
  createErrorResponse,
  createSuccessResponse,
  type McpToolResponse,
} from "../index.ts";
import type { McpConfig } from "../types.ts";

export function registerCreateRenameEpisodePlanTool(
  server: McpServer,
  config: McpConfig,
): void {
  const tool = buildCreateRenameEpisodePlanTool(
    config.appDataDir,
    config.fs ?? defaultChatFs(),
    config.broadcast,
    config.logger,
  );
  const description =
    config.toolDescriptions?.[CREATE_RENAME_EPISODE_PLAN] ??
    CREATE_RENAME_EPISODE_PLAN_DESCRIPTION;

  server.registerTool(
    CREATE_RENAME_EPISODE_PLAN,
    {
      description,
      inputSchema: createRenameEpisodePlanInputSchema,
    },
    async (args: unknown): Promise<McpToolResponse> => {
      const result = await tool.execute(args);
      if (result.error) {
        return createErrorResponse(result.error);
      }
      return createSuccessResponse(result);
    },
  );
}
