import { z } from 'zod';
import { executeHelloTask } from '../../tasks/HelloTask';
import { join } from 'path';
import type { ToolDefinition } from './types';
import { createSuccessResponse, createErrorResponse } from '@/mcp/tools/mcpToolBase';

async function getMediaFoldersList(): Promise<string[]> {
  const { userDataDir } = await executeHelloTask();
  const obj = await Bun.file(join(userDataDir, 'smm.json')).json();
  return obj.folders || [];
}

export function getTool(clientId?: string): ToolDefinition {
  return {
    toolName: 'get-media-folders',
    description: 'Get the media folders that are managed by SMM. Returns an array of folder paths.',
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

export function getMediaFoldersAgentTool(clientId: string) {
  return {
    description: getTool(clientId).description,
    inputSchema: getTool(clientId).inputSchema,
    outputSchema: getTool(clientId).outputSchema,
    execute: (args: any) => getTool(clientId).execute(args),
  };
}

export function getMediaFoldersMcpTool() {
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

