import type { CoreRoutesConfig, CoreRoutesLogger } from '@smm/core-routes'
import { buildAllowlist } from '@/utils/buildAllowlist'
import { buildHelloOptions } from '../../tasks/HelloTask'
import { buildCliHostRuntimeConfig } from '@/hostRuntimeConfig'

export async function buildCoreRoutesConfig(
  logger: CoreRoutesLogger,
): Promise<CoreRoutesConfig> {
  const allowlist = await buildAllowlist()
  const host = buildCliHostRuntimeConfig()
  return {
    allowlist,
    logger,
    hello: buildHelloOptions(null),
    userDataDir: host.userDataDir,
    appDataDir: host.appDataDir,
  }
}
