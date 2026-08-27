import {
  Core,
  NodejsFsAdapter,
  NoopLoggerAdapter,
  StaticDiscoverAdapter,
  type LoggerPort,
} from 'core-app'
import { detectOsLocale } from '@core/locale'
import { getUserDataDir, getAppDataDir, getTmpDir, getLogDir } from '@/utils/config'
import { APP_VERSION } from '@/version'
import { getBunMcpServerPort } from '@/mcp/BunMcpServerPort'
import { NodejsNetworkPort } from './NodejsNetworkPort'
import { wireCoreEvents } from './wireCoreEvents'

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
      version: APP_VERSION,
      reportedAppDataDir: getAppDataDir(),
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
