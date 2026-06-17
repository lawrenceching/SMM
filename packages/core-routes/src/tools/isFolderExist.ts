import {
  IS_FOLDER_EXIST,
  IS_FOLDER_EXIST_DESCRIPTION,
  isFolderExistInputSchema,
  isFolderExistOutputSchema,
  type IsFolderExistOutput,
} from "@smm/core/types/ai-tools/isFolderExist";
import { isFolderExistCheckFailed } from "@smm/core/ai-tool/isFolderExistResult";
import { requireNonEmptyString } from "@smm/core/ai-tool/toolResult";
import { resolveFolderExistence } from "../isFolderAvailable.ts";

/**
 * Core is-folder-exist execution. Mirrors the agent-side
 * `executeIsFolderExist` from `apps/cli/src/tools/isFolderExist.ts`.
 */
export async function executeIsFolderExist(
  path: string,
): Promise<IsFolderExistOutput> {
  const pathCheck = requireNonEmptyString(path, "path");
  if (typeof pathCheck !== "string") {
    return {
      exists: false,
      path: "",
      reason: pathCheck.error,
    };
  }

  try {
    return await resolveFolderExistence(pathCheck);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return isFolderExistCheckFailed(pathCheck, message);
  }
}

/**
 * Build the AI SDK `streamText` tool object for `IS_FOLDER_EXIST`.
 * The tool does not need any per-request context (no clientId, no
 * abortSignal) — it is a pure filesystem check.
 */
export function buildIsFolderExistTool() {
  return {
    description: IS_FOLDER_EXIST_DESCRIPTION,
    inputSchema: isFolderExistInputSchema,
    outputSchema: isFolderExistOutputSchema,
    execute: async (args: unknown) => {
      const { path } = (args ?? {}) as { path?: string };
      if (typeof path !== "string") {
        return {
          exists: false,
          path: "",
          reason: "path is required",
        };
      }
      return executeIsFolderExist(path);
    },
  };
}

/** Re-exported tool name constant for the tools registry. */
export const IS_FOLDER_EXIST_TOOL_NAME = IS_FOLDER_EXIST;
