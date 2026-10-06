import { acknowledge, getFirstAvailableSocket } from '@/utils/socketIO'
import { resolveAppLanguage, detectOsLocale } from '@smm/utils/locale'
import { getUserConfig } from '@/utils/config'
import { toolOk } from '@smm/core/ai-tool/toolResult'
import {
  GET_APPLICATION_CONTEXT_DESCRIPTION,
  getApplicationContextInputSchema,
  getApplicationContextOutputSchema,
  type GetApplicationContextOutput,
} from '@smm/types/ai-tools/getApplicationContext'

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
