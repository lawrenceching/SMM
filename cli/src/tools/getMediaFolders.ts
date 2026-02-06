import { z } from 'zod';
import { executeHelloTask } from '../../tasks/HelloTask';
import { join } from 'path';
import type { ToolDefinition } from './types';
import { createSuccessResponse, createErrorResponse } from '@/mcp/tools/mcpToolBase';
import { getLocalizedToolDescription } from '@/i18n/helpers';

async function getMediaFoldersList(): Promise<string[]> {
  const { userDataDir } = await executeHelloTask();
  const obj = await Bun.file(join(userDataDir, 'smm.json')).json();
  return obj.folders || [];
}

export const getTool = async function (clientId?: string): Promise<ToolDefinition> {
  // Use i18n to get localized tool description based on global user's language preference
  const description = await getLocalizedToolDescription('get-media-folders');

  return {
    toolName: 'get-media-folders',
    description: description,
    inputSchema: z.object({}),
    outputSchema: z.object({
      folders: z.array(z.string()).describe('Array of media folder paths managed by SMM'),
    }).describe('Object containing the list of media folders'),
    execute: async () => {
      try {
        const folders = await getMediaFoldersList();
        return createSuccessResponse({
          folders: folders,
        });
      } catch (error) {
        console.error('[getMediaFolders] Error:', error);
        return createErrorResponse(
          error instanceof Error ? error.message : 'Unknown error'
        );
      }
    },
  };
}

/**
 * Returns a tool definition with localized description for AI agent usage.
 * The description is localized based on the global user's language preference.
 *
 * @param clientId - Socket.IO client ID (for tool execution, not language)
 * @returns Promise resolving to localized tool definition
 */
export async function getMediaFoldersAgentTool(clientId: string) {
  const tool = await getTool(clientId);
  return {
    description: tool.description,
    inputSchema: tool.inputSchema,
    outputSchema: tool.outputSchema,
    execute: (args: any) => tool.execute(args),
  };
}

/**
 * Returns a tool definition with localized description for MCP server usage.
 * MCP tools use the global user's language preference.
 *
 * @returns Promise resolving to tool definition
 */
export async function getMediaFoldersMcpTool() {
  return getTool();
}

// Keep the original export for backward compatibility
export const getMediaFoldersTool = {
  description: 'Get the media folders that managed by SMM',
  inputSchema: z.object({}),
  execute: async (_args: {}, abortSignal?: AbortSignal) => {
    if (abortSignal?.aborted) {
      throw new Error('Request was aborted');
    }
    return getMediaFoldersList();
  },
};

