import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  GET_APPLICATION_CONTEXT,
  GET_APPLICATION_CONTEXT_DESCRIPTION,
  getApplicationContextInputSchema,
  getApplicationContextOutputSchema,
} from "@smm/core/types/ai-tools/getApplicationContext";
import {
  createErrorResponse,
  createSuccessResponse,
  type McpToolResponse,
} from "../index.ts";
import type { McpConfig } from "../types.ts";
import { executeGetApplicationContext } from "../../tools/getApplicationContext.ts";
import { resolveAppLanguage, detectOsLocale } from "@smm/core/locale";

/**
 * Register the `get-application-context` MCP tool. Returns the
 * currently-selected media folder (via Socket.IO) and the app's
 * language preference. The Socket.IO query is optional; when no
 * client is connected the tool returns an empty `selectedMediaFolder`
 * rather than failing.
 */
export function registerGetApplicationContextTool(
  server: McpServer,
  config: McpConfig,
): void {
  const description =
    config.toolDescriptions?.[GET_APPLICATION_CONTEXT] ??
    GET_APPLICATION_CONTEXT_DESCRIPTION;

  server.registerTool(
    GET_APPLICATION_CONTEXT,
    {
      description,
      inputSchema: getApplicationContextInputSchema,
      outputSchema: getApplicationContextOutputSchema,
    },
    async (): Promise<McpToolResponse> => {
      try {
        const userConfig = await config.getUserConfig();
        const language = resolveAppLanguage({
          configured: userConfig.applicationLanguage,
          osLocale: detectOsLocale(),
        });

        let selectedMediaFolder = "";
        if (config.acknowledge) {
          try {
            const responseData = (await config.acknowledge({
              event: "getSelectedMediaMetadata",
            }, 1000)) as
              | { selectedMediaMetadata?: { mediaFolderPath?: string } }
              | undefined;
            selectedMediaFolder =
              responseData?.selectedMediaMetadata?.mediaFolderPath ?? "";
          } catch {
            // Acknowledge failed (no connected UI, timeout, etc.) —
            // keep the empty default so the tool still returns
            // useful context (language).
          }
        }

        const result = await executeGetApplicationContext({
          selectedMediaFolder,
          language,
        });
        return createSuccessResponse(result as { [x: string]: unknown });
      } catch (error) {
        return createErrorResponse(
          error instanceof Error ? error.message : String(error),
        );
      }
    },
  );
}
