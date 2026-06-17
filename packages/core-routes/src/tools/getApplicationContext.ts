import {
  GET_APPLICATION_CONTEXT,
  GET_APPLICATION_CONTEXT_DESCRIPTION,
  getApplicationContextInputSchema,
  getApplicationContextOutputSchema,
  type GetApplicationContextOutput,
} from "@smm/core/types/ai-tools/getApplicationContext";
import type { UserConfig } from "@smm/core/types";
import { defaultAcknowledge } from "./acknowledge.ts";

/**
 * Pure execution of `getApplicationContext`. Takes the UI's reply
 * (already resolved via `acknowledge`) so this function is
 * testable without a live Socket.IO connection.
 */
export async function executeGetApplicationContext(
  params: {
    selectedMediaFolder: string;
    language: string;
  },
): Promise<GetApplicationContextOutput> {
  return {
    selectedMediaFolder: params.selectedMediaFolder,
    language: params.language,
  };
}

/**
 * Build the AI SDK `streamText` tool object for `GET_APPLICATION_CONTEXT`.
 *
 * The tool asks the UI for the currently-selected media folder via
 * the Socket.IO `acknowledge` mechanism. The injected `acknowledge`
 * may be `undefined` (e.g. when running without a connected UI) — in
 * that case the tool returns an empty `selectedMediaFolder` rather
 * than failing, mirroring the original `ChatTask` behavior.
 */
export function buildGetApplicationContextTool(
  clientId: string,
  userConfig: UserConfig,
  resolveLanguage: (userConfig: UserConfig) => string,
  acknowledge?: (
    message: unknown,
    timeoutMs?: number,
  ) => Promise<unknown>,
) {
  const ack = acknowledge ?? defaultAcknowledge;
  return {
    description: GET_APPLICATION_CONTEXT_DESCRIPTION,
    inputSchema: getApplicationContextInputSchema,
    outputSchema: getApplicationContextOutputSchema,
    execute: async () => {
      try {
        const [selectedMediaFolder, language] = await Promise.all([
          resolveSelectedMediaFolder(clientId, ack),
          resolveLanguage(userConfig),
        ]);
        return executeGetApplicationContext({
          selectedMediaFolder,
          language,
        });
      } catch (error) {
        return {
          selectedMediaFolder: "",
          language: "en",
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
  };
}

async function resolveSelectedMediaFolder(
  clientId: string,
  acknowledge: (message: unknown, timeoutMs?: number) => Promise<unknown>,
): Promise<string> {
  const responseData = (await acknowledge({
    event: "getSelectedMediaMetadata",
    clientId,
  }, 1000)) as { selectedMediaMetadata?: { mediaFolderPath?: string } } | undefined;
  return responseData?.selectedMediaMetadata?.mediaFolderPath ?? "";
}

/** Re-exported tool name constant for the tools registry. */
export const GET_APPLICATION_CONTEXT_TOOL_NAME = GET_APPLICATION_CONTEXT;
