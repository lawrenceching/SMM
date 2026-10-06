/**
 * apps/server — SMM HTTP server library (Hono + Socket.IO + MCP).
 *
 * Consumed by apps/cli (`smm web`). Dependency direction:
 * apps/cli -> apps/server -> apps/core. This package must never
 * import from apps/cli.
 */
export { Server, type ServerConfig } from './server'
export {
  getCore,
  resetCoreForTests,
  type GetCoreOptions,
} from './src/core/getCore'
export { buildCliHostRuntimeConfig } from './src/hostRuntimeConfig'
export { resolveHttpPort } from './src/httpPort'
export { logApplicationConfig } from './src/startup/applicationConfig'
export { logger } from './lib/logger'
export { registerGracefulShutdown } from './src/utils/gracefulShutdown'
export {
  getAppDataDir,
  getLogDir,
  getTmpDir,
  getUserConfig,
  getUserConfigPath,
  getUserDataDir,
} from './src/utils/config'
