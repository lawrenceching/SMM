import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  CREATE_RECOGNIZE_EPISODE_PLAN,
  CREATE_RECOGNIZE_EPISODE_PLAN_DESCRIPTION,
  createRecognizeEpisodePlanInputSchema,
} from "@smm/types/ai-tools/createRecognizeEpisodePlan";
import { defaultChatFs } from "../../chatFs.ts";
import { buildCreateRecognizeEpisodePlanTool } from "../../tools/createRecognizeEpisodePlan.ts";
import {
  createErrorResponse,
  createSuccessResponse,
  type McpToolResponse,
} from "../index.ts";
import type { McpConfig } from "../types.ts";

export function registerCreateRecognizeEpisodePlanTool(
  server: McpServer,
  config: McpConfig,
): void {
  const tool = buildCreateRecognizeEpisodePlanTool(
    config.appDataDir,
    config.fs ?? defaultChatFs(),
    config.broadcast,
    config.logger,
    undefined,
    {
      getUserConfig: config.getUserConfig,
      applyRecognizeEpisodePlan: config.applyRecognizeEpisodePlan,
    },
  );
  const description =
    config.toolDescriptions?.[CREATE_RECOGNIZE_EPISODE_PLAN] ??
    CREATE_RECOGNIZE_EPISODE_PLAN_DESCRIPTION;

  server.registerTool(
    CREATE_RECOGNIZE_EPISODE_PLAN,
    {
      description,
      inputSchema: createRecognizeEpisodePlanInputSchema,
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
