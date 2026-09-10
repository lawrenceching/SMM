import { createRecognizeEpisodePlanPipeline } from "@smm/core/createRecognizeEpisodePlan";
import { Path } from "@smm/utils/path";
import {
  AI_AGENT_PERMISSIONS,
  hasAiAgentPermission,
  type UserConfig,
} from "@smm/types";
import type { RecognizeMediaFilePlan } from "@smm/types/RecognizeMediaFilePlan";
import {
  CREATE_RECOGNIZE_EPISODE_PLAN,
  CREATE_RECOGNIZE_EPISODE_PLAN_DESCRIPTION,
  createRecognizeEpisodePlanInputSchema,
} from "@smm/types/ai-tools/createRecognizeEpisodePlan";
import {
  END_PLAN_TASK_SUCCESS_MESSAGE,
  RECOGNIZE_PLAN_AUTO_APPLIED_MESSAGE,
} from "@smm/types/ai-tools/planTaskMessages";
import {
  MEDIA_METADATA_UPDATED_EVENT,
  RecognizeMediaFilePlanReady,
  type RecognizeMediaFilePlanReadyRequestData,
} from "@smm/types/event-types";
import { formatToolError, toolOk } from "@smm/core/ai-tool/toolResult";
import type { ChatFs } from "../chatTypes.ts";
import type { CoreRoutesLogger } from "../types.ts";
import type { WebSocketMessage } from "../socketIO/types.ts";
import { defaultBroadcast } from "./broadcast.ts";
import { createFsPort, planPath } from "./chatFsPort.ts";

/**
 * Optional dependencies for the `metadata.write` auto-apply flow.
 * Auto-apply requires BOTH deps: without `getUserConfig` the tool
 * cannot verify the permission; without `applyRecognizeEpisodePlan`
 * (hosts without a Core instance, e.g. ohos) it cannot apply.
 */
export interface CreateRecognizeEpisodePlanToolExtra {
  /** Reads the current user config for the metadata.write permission check. */
  getUserConfig?: () => Promise<UserConfig>;
  /** Applies (merges metadata of) a created plan. Host Core runner, e.g. `Core.applyPlan`. */
  applyRecognizeEpisodePlan?: (plan: RecognizeMediaFilePlan) => Promise<void>;
}

export function buildCreateRecognizeEpisodePlanTool(
  appDataDir: string,
  fs: ChatFs,
  broadcast?: (message: WebSocketMessage) => void,
  logger?: CoreRoutesLogger,
  abortSignal?: AbortSignal,
  extra?: CreateRecognizeEpisodePlanToolExtra,
) {
  const emit = broadcast ?? defaultBroadcast;
  return {
    description: CREATE_RECOGNIZE_EPISODE_PLAN_DESCRIPTION,
    inputSchema: createRecognizeEpisodePlanInputSchema,
    execute: async (args: unknown) => {
      if (abortSignal?.aborted) {
        throw new Error("Request was aborted");
      }

      const parsed = createRecognizeEpisodePlanInputSchema.safeParse(args);
      if (!parsed.success) {
        return formatToolError(parsed.error);
      }

      try {
        const plan = await createRecognizeEpisodePlanPipeline(
          parsed.data.mediaFolderPath,
          parsed.data.files,
          { creator: "ai" },
          {
            fs: createFsPort(fs),
            appDataDir,
            normalizePosix: Path.posix,
          },
        );

        if (extra?.getUserConfig && extra.applyRecognizeEpisodePlan) {
          try {
            const userConfig = await extra.getUserConfig();
            if (
              hasAiAgentPermission(
                userConfig,
                AI_AGENT_PERMISSIONS.metadataWrite,
              )
            ) {
              await extra.applyRecognizeEpisodePlan(plan);
              emit({
                event: MEDIA_METADATA_UPDATED_EVENT,
                data: { folderPath: plan.mediaFolderPath },
              });
              logger?.info(
                {
                  planId: plan.id,
                  folderPath: plan.mediaFolderPath,
                  fileCount: plan.files.length,
                },
                `[tool][${CREATE_RECOGNIZE_EPISODE_PLAN}] Plan applied automatically`,
              );
              return toolOk({
                message: RECOGNIZE_PLAN_AUTO_APPLIED_MESSAGE,
                planId: plan.id,
              });
            }
          } catch (error) {
            logger?.warn(
              { planId: plan.id, error },
              `[tool][${CREATE_RECOGNIZE_EPISODE_PLAN}] Auto-apply failed, plan stays pending`,
            );
          }
        }

        const data: RecognizeMediaFilePlanReadyRequestData = {
          taskId: plan.id,
          planFilePath: planPath(appDataDir, plan.id),
        };
        emit({ event: RecognizeMediaFilePlanReady.event, data });
        logger?.info(
          {
            planId: plan.id,
            folderPath: plan.mediaFolderPath,
            fileCount: plan.files.length,
          },
          `[tool][${CREATE_RECOGNIZE_EPISODE_PLAN}] Plan created`,
        );

        return toolOk({
          message: END_PLAN_TASK_SUCCESS_MESSAGE,
          planId: plan.id,
        });
      } catch (error) {
        return formatToolError(error);
      }
    },
  };
}

