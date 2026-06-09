import { validatePathIsInAllowlist as validatePathInAllowlistCore } from '@smm/core-routes';
import { buildAllowlist } from '@/utils/buildAllowlist';
import logger, { maskOsUsername } from '../../lib/logger';

/**
 * @param filePath path in POSIX format
 */
export async function validatePathIsInAllowlist(filePath: string): Promise<boolean> {
  const allowlist = await buildAllowlist();

  logger.debug({
    allowlist: allowlist.map((i) => maskOsUsername(i)),
    filePath: maskOsUsername(filePath),
  }, 'Validating path is in allowlist');

  return validatePathInAllowlistCore(filePath, allowlist);
}
