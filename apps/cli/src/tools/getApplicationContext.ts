import { acknowledge, findSocketByClientId, getFirstAvailableSocket } from '@/utils/socketIO';
import { z } from 'zod';
import type { ToolDefinition } from './types';
import { createSuccessResponse, createErrorResponse } from '@/mcp/tools/mcpToolBase';
import { getUserConfig } from '@/utils/config';
import { getLocalizedToolDescription } from '@/i18n/helpers';


async function getLanguage() {
  const userConfig = await getUserConfig();
  return userConfig.applicationLanguage ?? 'zh-CN';
}

async function getSelectedMediaFolder(_clientId?: string) {

  let clientId: string | undefined = _clientId;
  if(clientId === undefined) {
    const socket = getFirstAvailableSocket();
    if(socket === null) {
      return ''
    }
    clientId = socket.clientId;
  }

  const responseData = await acknowledge(
    {
      event: 'getSelectedMediaMetadata',
      clientId: clientId,
    },
  );

  return responseData?.selectedMediaMetadata?.mediaFolderPath ?? '';

}

export const getTool = async function (clientId?: string): Promise<ToolDefinition> {
  // Use i18n to get localized tool description based on user's language preference
  const description = await getLocalizedToolDescription('get-app-context');

  return {
    toolName: 'get-app-context',
    description: description,
    inputSchema: z.object({}),
    outputSchema: z.object({
      selectedMediaFolder: z.string().describe("The path of the media folder that user selected in UI."),
      language: z.string().describe("The language in user preferences."),
    }),
    execute: async (path: { path: string }) => {

      if(clientId === undefined) {
        const socket = getFirstAvailableSocket();
        if(socket === null) {
          return createErrorResponse('No active Socket.IO connections available');
        }
        clientId = socket.clientId;
      }

      try {
        return createSuccessResponse({
          selectedMediaFolder: await getSelectedMediaFolder(clientId),
          language: await getLanguage()
        });
      } catch (error) {
        console.error('[GetSelectedMediaMetadataTask] Error:', error);
        return createErrorResponse(
          error instanceof Error ? error.message : 'Unknown error'
        );
      }
    },

  }
}

/**
 * Returns a tool definition with localized description for AI agent usage.
 * The description is localized based on the global user's language preference.
 *
 * Pattern for adding i18n to other tools:
 * 1. Import getLocalizedToolDescription from '@/i18n/helpers'
 * 2. Make getTool function async
 * 3. Call getLocalizedToolDescription('tool-name')
 * 4. Make these export functions async as well
 *
 * @param clientId - Socket.IO client ID (for tool execution, not language)
 * @returns Promise resolving to localized tool definition
 */
/**
 * Returns a tool definition for AI agent usage.
 * Uses fixed English description for synchronous return.
 *
 * @param clientId - Socket.IO client ID (for tool execution, not language)
 * @returns Tool definition (synchronous)
 */
export function getApplicationContextAgentTool(clientId: string) {
  return {
    description: "Get SMM context including selected media folder path and user language preference.",
    inputSchema: z.object({}),
    outputSchema: z.object({
      selectedMediaFolder: z.string().describe("The path of the media folder that user selected in UI."),
      language: z.string().describe("The language in user preferences."),
    }),
    execute: async (args: any) => {
      let _clientId = clientId;

      if(_clientId === undefined) {
        const socket = getFirstAvailableSocket();
        if(socket === null) {
          return createErrorResponse('No active Socket.IO connections available');
        }
        _clientId = socket.clientId;
      }

      try {
        return createSuccessResponse({
          selectedMediaFolder: await getSelectedMediaFolder(_clientId),
          language: await getLanguage()
        });
      } catch (error) {
        console.error('[GetSelectedMediaMetadataTask] Error:', error);
        return createErrorResponse(
          error instanceof Error ? error.message : 'Unknown error'
        );
      }
    },
  };
}

/**
 * Returns a tool definition with English description for MCP server usage.
 * MCP tools use English as the default language (no clientId context).
 *
 * @returns Promise resolving to tool definition with English description
 */
export async function getApplicationContextMcpTool() {
  return getTool();
}