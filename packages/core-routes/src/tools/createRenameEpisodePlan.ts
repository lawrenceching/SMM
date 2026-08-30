import { createRenameEpisodePlanPipeline } from "@smm/core/createRenameEpisodePlan";
import type { FsPort } from "@smm/core/FsPort";
import { Path } from "@smm/utils/path";
import {
  CREATE_RENAME_EPISODE_PLAN,
  CREATE_RENAME_EPISODE_PLAN_DESCRIPTION,
  createRenameEpisodePlanInputSchema,
} from "@smm/types/ai-tools/createRenameEpisodePlan";
import { END_PLAN_TASK_SUCCESS_MESSAGE } from "@smm/types/ai-tools/planTaskMessages";
import {
  RenameFilesPlanReady,
  type RenameFilesPlanReadyRequestData,
} from "@smm/types/event-types";
import { formatToolError, toolOk } from "@smm/core/ai-tool/toolResult";
import type { ChatFs } from "../chatTypes.ts";
import type { CoreRoutesLogger } from "../types.ts";
import type { WebSocketMessage } from "../socketIO/types.ts";
import { defaultBroadcast } from "./broadcast.ts";

function unsupportedFsOperation(name: string): never {
  throw new Error(`${name} is not supported by the rename-plan filesystem adapter`);
}

function createFsPort(fs: ChatFs): FsPort {
  return {
    async readTextFile(path: string): Promise<string> {
      const value = await fs.readJson(path);
      if (value === null) {
        throw new Error(`File not found: ${path}`);
      }
      return JSON.stringify(value);
    },
    async writeTextFile(path: string, content: string): Promise<void> {
      await fs.writeJson(path, JSON.parse(content) as unknown);
    },
    async writeBinaryFile(): Promise<void> {
      unsupportedFsOperation("writeBinaryFile");
    },
    exists: (path: string) => fs.exists(path),
    isFile: (path: string) => fs.exists(path),
    async listFiles(): Promise<string[]> {
      return unsupportedFsOperation("listFiles");
    },
    async listSubdirectories(): Promise<string[]> {
      return unsupportedFsOperation("listSubdirectories");
    },
    async deleteFile(): Promise<void> {
      unsupportedFsOperation("deleteFile");
    },
    async rename(): Promise<void> {
      unsupportedFsOperation("rename");
    },
    async mkdir(): Promise<void> {
      unsupportedFsOperation("mkdir");
    },
  };
}

function metadataPath(appDataDir: string, mediaFolderPath: string): string {
  const filename = Path.posix(mediaFolderPath).replace(/[/\\:?*|<>"]/g, "_");
  return new Path(appDataDir, `metadata/${filename}.json`).abs("posix");
}

function planPath(appDataDir: string, planId: string): string {
  return new Path(appDataDir, `plans/${planId}.plan.json`).abs("posix");
}

export function buildCreateRenameEpisodePlanTool(
  appDataDir: string,
  fs: ChatFs,
  broadcast?: (message: WebSocketMessage) => void,
  logger?: CoreRoutesLogger,
  abortSignal?: AbortSignal,
) {
  const emit = broadcast ?? defaultBroadcast;
  return {
    description: CREATE_RENAME_EPISODE_PLAN_DESCRIPTION,
    inputSchema: createRenameEpisodePlanInputSchema,
    execute: async (args: unknown) => {
      if (abortSignal?.aborted) {
        throw new Error("Request was aborted");
      }

      const parsed = createRenameEpisodePlanInputSchema.safeParse(args);
      if (!parsed.success) {
        return formatToolError(parsed.error);
      }

      try {
        const plan = await createRenameEpisodePlanPipeline(
          parsed.data.mediaFolderPath,
          parsed.data.files,
          { creator: "ai" },
          {
            fs: createFsPort(fs),
            appDataDir,
            normalizePosix: Path.posix,
            getMediaMetadata: (folder) =>
              fs.readJson(metadataPath(appDataDir, folder)),
          },
        );

        const data: RenameFilesPlanReadyRequestData = {
          taskId: plan.id,
          planFilePath: planPath(appDataDir, plan.id),
        };
        emit({ event: RenameFilesPlanReady.event, data });
        logger?.info(
          {
            planId: plan.id,
            folderPath: plan.mediaFolderPath,
            fileCount: plan.files.length,
          },
          `[tool][${CREATE_RENAME_EPISODE_PLAN}] Plan created`,
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

export const CREATE_RENAME_EPISODE_PLAN_TOOL_NAME =
  CREATE_RENAME_EPISODE_PLAN;
