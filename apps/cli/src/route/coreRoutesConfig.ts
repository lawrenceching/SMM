import type { ChatConfig, CoreRoutesConfig, CoreRoutesLogger } from '@smm/core-routes'
import { buildAllowlist } from '@/utils/buildAllowlist'
import { getAppDataDir } from '@/utils/config'
import { buildHelloOptions } from '../../tasks/HelloTask'
import { createAIProvider } from '../../lib/ai-provider'
import { getUserConfig } from '@/utils/config'
import { acknowledge as socketAcknowledge } from '@/utils/socketIO'

export async function buildCoreRoutesConfig(
  logger: CoreRoutesLogger,
): Promise<CoreRoutesConfig> {
  const allowlist = await buildAllowlist()
  const appDataDir = getAppDataDir()
  return {
    allowlist,
    logger,
    hello: buildHelloOptions(null),
    appDataDir,
  }
}

/**
 * Build the {@link ChatConfig} that drives `POST /api/chat` in
 * `apps/cli`. The chat pipeline lives in `@smm/core-routes`; this
 * module is the Bun-specific wiring (provider factory, user-config
 * reader, Socket.IO acknowledge helper, plan-rename deps).
 */
export function buildChatConfig(
  logger: CoreRoutesLogger,
  appDataDir: string,
): ChatConfig {
  return {
    appDataDir,
    logger,
    createAIProvider: (userConfig) => createAIProvider(userConfig),
    getUserConfig: () => getUserConfig(),
    acknowledge: (message, timeoutMs) => socketAcknowledge(message as never, timeoutMs),
  }
}


