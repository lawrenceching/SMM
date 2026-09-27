import {
  Core,
  NodejsFsAdapter,
  NoopLoggerAdapter,
  StaticDiscoverAdapter,
  type LoggerPort,
} from '@smm/core'
import { getBunMcpServerPort } from '@/mcp/BunMcpServerPort'
import { NodejsNetworkPort } from './NodejsNetworkPort'
import { wireCoreEvents } from './wireCoreEvents'
import { buildCliHostRuntimeConfig } from '@/hostRuntimeConfig'

let instance: Core | undefined

export interface GetCoreOptions {
  logger?: LoggerPort
}

/** Lazy singleton with separate application-data and user-config roots. */
export function getCore(options?: GetCoreOptions): Core {
  if (!instance) {
    const host = buildCliHostRuntimeConfig()
    instance = new Core({
      fs: new NodejsFsAdapter(),
      network: new NodejsNetworkPort(),
      logger: options?.logger ?? new NoopLoggerAdapter(),
      appDataDir: host.appDataDir,
      userDataDir: host.userDataDir,
      version: host.version,
      reportedAppDataDir: host.appDataDir,
      tmpDir: host.tmpDir,
      logDir: host.logDir,
      platform: host.platform,
      osLocale: host.osLocale,
      discover: new StaticDiscoverAdapter(),
      mcpServer: getBunMcpServerPort(),
    })
    wireCoreEvents(instance)
  }
  return instance
}

/** Test-only: drop the singleton so env/dir changes take effect. */
export function resetCoreForTests(): void {
  instance = undefined
}
