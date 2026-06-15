import { acknowledge, getFirstAvailableSocket } from '@/utils/socketIO'
import { z } from 'zod'
import type { ToolDefinition } from './types'
import { createSuccessResponse, createErrorResponse } from '@/mcp/tools/mcpToolBase'
import { resolveAppLanguage, detectOsLocale } from '@core/locale'
import { getUserConfig } from '@/utils/config'
import { getLocalizedToolDescription } from '@/i18n/helpers'
import { toolOk } from '@core/ai-tool/toolResult'
import {
  GET_APPLICATION_CONTEXT,
  GET_APPLICATION_CONTEXT_DESCRIPTION,
  getApplicationContextInputSchema,
  getApplicationContextOutputSchema,
  type GetApplicationContextOutput,
} from '@core/types/ai-tools/getApplicationContext'

// ─── Private helpers ────────────────────────────────────────────

async function resolveLanguage(): Promise<string> {
  const userConfig = await getUserConfig()
  return resolveAppLanguage({
    configured: userConfig.applicationLanguage,
    osLocale: detectOsLocale(),
  })
}

async function resolveSelectedMediaFolder(clientId?: string): Promise<string> {
  let id = clientId
  if (id === undefined) {
    const socket = getFirstAvailableSocket()
    if (socket === null) return ''
    id = socket.clientId
  }

  const responseData = await acknowledge({
    event: 'getSelectedMediaMetadata',
    clientId: id,
  })

  return responseData?.selectedMediaMetadata?.mediaFolderPath ?? ''
}

async function executeGetApplicationContext(
  clientId?: string,
): Promise<GetApplicationContextOutput> {
  const [selectedMediaFolder, language] = await Promise.all([
    resolveSelectedMediaFolder(clientId),
    resolveLanguage(),
  ])
  return { selectedMediaFolder, language }
}

// ─── Agent tool (ChatTask / streamText) ─────────────────────────

export function getApplicationContextAgentTool(clientId: string) {
  return {
    description: GET_APPLICATION_CONTEXT_DESCRIPTION,
    inputSchema: getApplicationContextInputSchema,
    outputSchema: getApplicationContextOutputSchema,
    execute: async () => {
      try {
        const result = await executeGetApplicationContext(clientId)
        return toolOk(result)
      } catch (error) {
        console.error('[getApplicationContext] Agent tool error:', error)
        return {
          selectedMediaFolder: '',
          language: 'en',
          error: error instanceof Error ? error.message : 'Unknown error',
        }
      }
    },
  }
}

// ─── MCP tool (localised description) ───────────────────────────

export async function getApplicationContextMcpTool(): Promise<ToolDefinition> {
  const description = await getLocalizedToolDescription(GET_APPLICATION_CONTEXT)

  return {
    toolName: GET_APPLICATION_CONTEXT,
    description,
    inputSchema: getApplicationContextInputSchema,
    outputSchema: getApplicationContextOutputSchema,
    execute: async () => {
      try {
        const result = await executeGetApplicationContext()
        return createSuccessResponse(
          result as unknown as { [x: string]: unknown },
        )
      } catch (error) {
        console.error('[getApplicationContext] MCP tool error:', error)
        return createErrorResponse(
          error instanceof Error ? error.message : 'Unknown error',
        )
      }
    },
  }
}
