import { Path } from "@smm/core/path";
import { buildRenameFolderConfirmationMessage } from "@smm/core/ai-tool/renameFolderConfirm";
import {
  renameFolderCancelled,
  renameFolderFailed,
  renameFolderSucceeded,
} from "@smm/core/ai-tool/renameFolderResult";
import { requireNonEmptyString } from "@smm/core/ai-tool/toolResult";
import {
  RENAME_FOLDER,
  RENAME_FOLDER_DESCRIPTION,
  renameFolderInputSchema,
  renameFolderOutputSchema,
  type RenameFolderOutput,
} from "@smm/core/types/ai-tools/renameFolder";
import { doRenameFolder } from "../renameFolder.ts";
import type { CoreRoutesConfig } from "../types.ts";
import { defaultAcknowledge } from "./acknowledge.ts";

export interface RenameFolderParams {
  from: string;
  to: string;
}

/**
 * Core rename-folder execution (no confirmation). Mirrors
 * `executeRenameFolder` from `apps/cli/src/tools/renameFolder.ts`.
 */
export async function executeRenameFolder(
  params: RenameFolderParams,
  config: CoreRoutesConfig,
  abortSignal?: AbortSignal,
): Promise<RenameFolderOutput> {
  if (abortSignal?.aborted) {
    throw new Error("Request was aborted");
  }

  const fromCheck = requireNonEmptyString(params.from, "from");
  if (typeof fromCheck !== "string") {
    return renameFolderFailed("", "", fromCheck.error);
  }
  const toCheck = requireNonEmptyString(params.to, "to");
  if (typeof toCheck !== "string") {
    return renameFolderFailed(fromCheck, "", toCheck.error);
  }

  try {
    const result = await doRenameFolder({ from: fromCheck, to: toCheck }, config);

    if (result.error) {
      return renameFolderFailed(fromCheck, toCheck, result.error);
    }

    return renameFolderSucceeded(fromCheck, toCheck);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return renameFolderFailed(
      fromCheck,
      toCheck,
      `Error renaming folder: ${message}`,
    );
  }
}

async function confirmRenameFolderViaSocket(
  clientId: string,
  from: string,
  to: string,
  acknowledge: (
    message: unknown,
    timeoutMs?: number,
  ) => Promise<unknown>,
): Promise<RenameFolderOutput | null> {
  const confirmationMessage = buildRenameFolderConfirmationMessage(from, to);

  try {
    const responseData = (await acknowledge({
      event: "askForConfirmation",
      data: { message: confirmationMessage },
      clientId,
    }, 30_000)) as { confirmed?: boolean; response?: string } | undefined;

    const confirmed =
      responseData?.confirmed ?? responseData?.response === "yes";

    if (!confirmed) {
      return renameFolderCancelled(from, to);
    }
    return null;
  } catch (error) {
    return renameFolderFailed(
      from,
      to,
      `Failed to get user confirmation: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    );
  }
}

/**
 * Build the AI SDK `streamText` tool object for `RENAME_FOLDER`.
 *
 * The tool first asks the user for confirmation via the Socket.IO
 * `askForConfirmation` event, then delegates the actual rename to
 * `doRenameFolder` (which updates the metadata cache + user config).
 */
export function buildRenameFolderTool(
  clientId: string,
  config: CoreRoutesConfig,
  abortSignal?: AbortSignal,
  acknowledge?: (
    message: unknown,
    timeoutMs?: number,
  ) => Promise<unknown>,
) {
  const ack = acknowledge ?? defaultAcknowledge;
  return {
    description: RENAME_FOLDER_DESCRIPTION,
    inputSchema: renameFolderInputSchema,
    outputSchema: renameFolderOutputSchema,
    execute: async (args: unknown) => {
      if (abortSignal?.aborted) {
        throw new Error("Request was aborted");
      }
      const params = (args ?? {}) as RenameFolderParams;

      const fromCheck = requireNonEmptyString(params.from, "from");
      if (typeof fromCheck !== "string") {
        return renameFolderFailed("", "", fromCheck.error);
      }
      const toCheck = requireNonEmptyString(params.to, "to");
      if (typeof toCheck !== "string") {
        return renameFolderFailed(fromCheck, "", toCheck.error);
      }

      const cancelOrError = await confirmRenameFolderViaSocket(
        clientId,
        fromCheck,
        toCheck,
        ack,
      );
      if (cancelOrError) {
        return cancelOrError;
      }

      if (abortSignal?.aborted) {
        throw new Error("Request was aborted");
      }

      return executeRenameFolder(
        { from: fromCheck, to: toCheck },
        config,
        abortSignal,
      );
    },
  };
}

/** Re-exported tool name constant for the tools registry. */
export const RENAME_FOLDER_TOOL_NAME = RENAME_FOLDER;
