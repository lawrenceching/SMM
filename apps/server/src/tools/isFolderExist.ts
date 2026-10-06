import { resolveFolderExistence } from '@smm/core-routes'
import {
  IS_FOLDER_EXIST_DESCRIPTION,
  isFolderExistInputSchema,
  isFolderExistOutputSchema,
  type IsFolderExistOutput,
} from '@smm/types/ai-tools/isFolderExist'
import { isFolderExistCheckFailed } from '@smm/core/ai-tool/isFolderExistResult'
import { requireNonEmptyString } from '@smm/core/ai-tool/toolResult'

export type { IsFolderExistOutput }

/**
 * Core is-folder-exist execution (no MCP wrapping). Used by agent tools.
 */
async function executeIsFolderExist(
  path: string,
): Promise<IsFolderExistOutput> {
  const pathCheck = requireNonEmptyString(path, 'path')
  if (typeof pathCheck !== 'string') {
    return {
      exists: false,
      path: '',
      reason: pathCheck.error,
    }
  }

  try {
    return await resolveFolderExistence(pathCheck)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return isFolderExistCheckFailed(pathCheck, message)
  }
}

function createAgentIsFolderExistTool() {
  return {
    description: IS_FOLDER_EXIST_DESCRIPTION,
    inputSchema: isFolderExistInputSchema,
    outputSchema: isFolderExistOutputSchema,
    execute: async ({ path }: { path: string }) => executeIsFolderExist(path),
  }
}

export function isFolderExistAgentTool(_clientId: string) {
  return createAgentIsFolderExistTool()
}
