import {
  Core,
  NodejsFsAdapter,
  NoopLoggerAdapter,
  StaticDiscoverAdapter,
  type LoggerPort,
} from '@smm/core'
import { detectOsLocale } from '@smm/utils/locale'
import { getUserDataDir, getAppDataDir, getTmpDir, getLogDir } from '@/utils/config'
import { APP_VERSION } from '@/version'
import { getBunMcpServerPort } from '@/mcp/BunMcpServerPort'
import { NodejsNetworkPort } from './NodejsNetworkPort'
import { wireCoreEvents } from './wireCoreEvents'

let instance: Core | undefined

export interface GetCoreOptions {
  logger?: LoggerPort
}

/** Lazy singleton with separate application-data and user-config roots. */
export function getCore(options?: GetCoreOptions): Core {
  if (!instance) {
    const appDataDir = getAppDataDir()
    instance = new Core({
      fs: new NodejsFsAdapter(),
      network: new NodejsNetworkPort(),
      logger: options?.logger ?? new NoopLoggerAdapter(),
      appDataDir,
      userDataDir: getUserDataDir(),
      version: APP_VERSION,
      reportedAppDataDir: appDataDir,
      tmpDir: getTmpDir(),
      logDir: getLogDir(),
      platform: process.platform,
      osLocale: detectOsLocale(),
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
