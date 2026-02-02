import { acknowledge, findSocketByClientId, getFirstAvailableSocket } from '@/utils/socketIO';
import { z } from 'zod';
import type { ToolDefinition } from './types';
import { createSuccessResponse, createErrorResponse } from '@/mcp/tools/mcpToolBase';
import { getUserConfig } from '@/utils/config';


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

export const getTool = function (clientId?: string): ToolDefinition {
  return {
    toolName: 'get-app-context',
    description: `Get SMM context:
  * The media folder user selected/focused on SMM UI
  * The language in user preferences
  `,
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



export function getApplicationContextAgentTool(clientId: string) {
  return {
    description: getTool(clientId).description,
    inputSchema: getTool(clientId).inputSchema,
    outputSchema: getTool(clientId).outputSchema,
    execute: (args: any) => getTool(clientId).execute(args),
  }
}

export function getApplicationContextMcpTool() {
  return getTool();
}