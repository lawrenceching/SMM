import { Path } from "@smm/core/path";
import { buildRenameEpisodeFileConfirmationMessage } from "@smm/core/ai-tool/renameEpisodeFileConfirm";
import {
  renameEpisodeFileCancelled,
  renameEpisodeFileFailed,
  renameEpisodeFileSucceeded,
} from "@smm/core/ai-tool/renameEpisodeFileResult";
import { requireNonEmptyString } from "@smm/core/ai-tool/toolResult";
import {
  RENAME_EPISODE_FILE,
  RENAME_EPISODE_FILE_DESCRIPTION,
  renameEpisodeFileInputSchema,
  renameEpisodeFileOutputSchema,
  type RenameEpisodeFileOutput,
} from "@smm/core/types/ai-tools/renameEpisodeFile";
import { defaultAcknowledge } from "./acknowledge.ts";

export interface RenameEpisodeFileParams {
  mediaFolder: string;
  from: string;
  to: string;
}

export type RenameEpisodeFileRunner = (input: {
  mediaFolderPath: string;
  from: string;
  to: string;
}) => Promise<{
  succeeded: Array<{ from: string; to: string }>;
  failed: Array<{ path: string; error: string }>;
}>;

/**
 * Core rename-episode-file execution (no confirmation). Hosts inject
 * a runner that typically calls `Core.renameEpisodeFile`.
 */
export async function executeRenameEpisodeFile(
  params: RenameEpisodeFileParams,
  runner: RenameEpisodeFileRunner | undefined,
  abortSignal?: AbortSignal,
): Promise<RenameEpisodeFileOutput> {
  if (abortSignal?.aborted) {
    throw new Error("Request was aborted");
  }

  const folderCheck = requireNonEmptyString(params.mediaFolder, "mediaFolder");
  if (typeof folderCheck !== "string") {
    return renameEpisodeFileFailed("", "", "", folderCheck.error);
  }
  const fromCheck = requireNonEmptyString(params.from, "from");
  if (typeof fromCheck !== "string") {
    return renameEpisodeFileFailed(folderCheck, "", "", fromCheck.error);
  }
  const toCheck = requireNonEmptyString(params.to, "to");
  if (typeof toCheck !== "string") {
    return renameEpisodeFileFailed(folderCheck, fromCheck, "", toCheck.error);
  }

  if (!runner) {
    return renameEpisodeFileFailed(
      folderCheck,
      fromCheck,
      toCheck,
      "rename-episode-file is not available on this host",
    );
  }

  try {
    const result = await runner({
      mediaFolderPath: folderCheck,
      from: fromCheck,
      to: toCheck,
    });
    return renameEpisodeFileSucceeded(
      folderCheck,
      fromCheck,
      toCheck,
      result.succeeded,
      result.failed,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return renameEpisodeFileFailed(
      folderCheck,
      fromCheck,
      toCheck,
      `Error renaming episode file: ${message}`,
    );
  }
}

async function confirmRenameEpisodeFileViaSocket(
  clientId: string,
  from: string,
  to: string,
  acknowledge: (
    message: unknown,
    timeoutMs?: number,
  ) => Promise<unknown>,
): Promise<RenameEpisodeFileOutput | null> {
  const confirmationMessage = buildRenameEpisodeFileConfirmationMessage(from, to);

  try {
    const responseData = (await acknowledge(
      {
        event: "askForConfirmation",
        data: { message: confirmationMessage },
        clientId,
      },
      30_000,
    )) as { confirmed?: boolean; response?: string } | undefined;

    const confirmed =
      responseData?.confirmed ?? responseData?.response === "yes";

    if (!confirmed) {
      return renameEpisodeFileCancelled("", from, to);
    }
    return null;
  } catch (error) {
    return renameEpisodeFileFailed(
      "",
      from,
      to,
      `Failed to get user confirmation: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    );
  }
}

/**
 * Build the AI SDK tool for `RENAME_EPISODE_FILE` (server-side chat).
 * Confirms via Socket, then runs the injected Core runner.
 */
export function buildRenameEpisodeFileTool(
  clientId: string,
  runner: RenameEpisodeFileRunner | undefined,
  abortSignal?: AbortSignal,
  acknowledge?: (
    message: unknown,
    timeoutMs?: number,
  ) => Promise<unknown>,
) {
  const ack = acknowledge ?? defaultAcknowledge;
  return {
    description: RENAME_EPISODE_FILE_DESCRIPTION,
    inputSchema: renameEpisodeFileInputSchema,
    outputSchema: renameEpisodeFileOutputSchema,
    execute: async (args: unknown) => {
      if (abortSignal?.aborted) {
        throw new Error("Request was aborted");
      }
      const params = (args ?? {}) as RenameEpisodeFileParams;

      const folderCheck = requireNonEmptyString(params.mediaFolder, "mediaFolder");
      if (typeof folderCheck !== "string") {
        return renameEpisodeFileFailed("", "", "", folderCheck.error);
      }
      const fromCheck = requireNonEmptyString(params.from, "from");
      if (typeof fromCheck !== "string") {
        return renameEpisodeFileFailed(folderCheck, "", "", fromCheck.error);
      }
      const toCheck = requireNonEmptyString(params.to, "to");
      if (typeof toCheck !== "string") {
        return renameEpisodeFileFailed(folderCheck, fromCheck, "", toCheck.error);
      }

      const cancelOrError = await confirmRenameEpisodeFileViaSocket(
        clientId,
        fromCheck,
        toCheck,
        ack,
      );
      if (cancelOrError) {
        return {
          ...cancelOrError,
          mediaFolder: Path.toPlatformPath(folderCheck),
        };
      }

      if (abortSignal?.aborted) {
        throw new Error("Request was aborted");
      }

      return executeRenameEpisodeFile(
        { mediaFolder: folderCheck, from: fromCheck, to: toCheck },
        runner,
        abortSignal,
      );
    },
  };
}

/** Re-exported tool name constant for the tools registry. */
export const RENAME_EPISODE_FILE_TOOL_NAME = RENAME_EPISODE_FILE;
