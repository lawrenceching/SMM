import {
  Core,
  NodejsFsAdapter,
  NoopLoggerAdapter,
  StaticDiscoverAdapter,
  type LoggerPort,
} from 'core-app'
import { getUserDataDir } from '@/utils/config'
import { getBunMcpServerPort } from '@/mcp/BunMcpServerPort'
import { NodejsNetworkPort } from './NodejsNetworkPort'

let instance: Core | undefined

export interface GetCoreOptions {
  logger?: LoggerPort
}

/** Lazy singleton. appDataDir = userDataDir so getFolders reads production smm.json. */
export function getCore(options?: GetCoreOptions): Core {
  if (!instance) {
    const userDataDir = getUserDataDir()
    instance = new Core({
      fs: new NodejsFsAdapter(),
      network: new NodejsNetworkPort(),
      logger: options?.logger ?? new NoopLoggerAdapter(),
      appDataDir: userDataDir,
      userDataDir,
      discover: new StaticDiscoverAdapter(),
      mcpServer: getBunMcpServerPort(),
    })
  }
  return instance
}

/** Test-only: drop the singleton so env/dir changes take effect. */
export function resetCoreForTests(): void {
  instance = undefined
}
