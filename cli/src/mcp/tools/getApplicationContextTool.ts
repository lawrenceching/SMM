import { getUserConfig } from "@/utils/config";
import type { McpToolResponse } from "./mcpToolBase";

/**
 * Get application context including configured media folders and settings.
 */
export async function handleGetApplicationContext(): Promise<McpToolResponse> {
  try {
    const userConfig = await getUserConfig();

    const context = {
      selectedAI: userConfig.selectedAI,
      applicationLanguage: userConfig.applicationLanguage,
      folders: userConfig.folders ?? [],
      selectedRenameRule: userConfig.selectedRenameRule,
      tmdb: userConfig.tmdb,
    };

    return {
      content: [{ type: "text" as const, text: JSON.stringify({ success: true, context }, null, 2) }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text" as const, text: `Error getting application context: ${message}` }],
      isError: true,
    };
  }
}
