import type { CoreRoutesConfig, CoreRoutesLogger } from '@smm/core-routes'
import { buildAllowlist } from '@/utils/buildAllowlist'
import { getAppDataDir } from '@/utils/config'
import { buildHelloOptions } from '../../tasks/HelloTask'

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
