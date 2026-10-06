import {
  Core,
  NodejsFsAdapter,
  NoopLoggerAdapter,
  StaticDiscoverAdapter,
  type AppContextInput,
  type LoggerPort,
  type PlatformPortsInput,
} from '@smm/core'
import { getBunMcpServerPort } from '@/mcp/BunMcpServerPort'
import { NodejsNetworkPort } from './NodejsNetworkPort'
import { wireCoreEvents } from './wireCoreEvents'
import { buildCliHostRuntimeConfig } from '@/hostRuntimeConfig'

let instance: Core | undefined

export interface GetCoreOptions {
  logger?: LoggerPort
  /** Test-only: override AppContext fields used when constructing Core. */
  _context?: Partial<AppContextInput>
  /** Test-only: override platform ports used when constructing Core. */
  _ports?: Partial<PlatformPortsInput>
}

/** Lazy singleton with separate application-data and user-config roots. */
export function getCore(options?: GetCoreOptions): Core {
  if (!instance) {
    const host = buildCliHostRuntimeConfig()
    instance = new Core({
      context: {
        appDataDir: host.appDataDir,
        userDataDir: host.userDataDir,
        version: host.version,
        reportedAppDataDir: host.appDataDir,
        tmpDir: host.tmpDir,
        logDir: host.logDir,
        platform: host.platform,
        osLocale: host.osLocale,
        ...options?._context,
      },
      ports: {
        fs: new NodejsFsAdapter(),
        network: new NodejsNetworkPort(),
        discover: new StaticDiscoverAdapter(),
        ...options?._ports,
        logger:
          options?._ports?.logger ?? options?.logger ?? new NoopLoggerAdapter(),
      },
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
