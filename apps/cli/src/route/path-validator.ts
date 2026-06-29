import { validatePathIsInAllowlist as validatePathInAllowlistCore } from '@smm/core-routes';
import { buildAllowlist } from '@/utils/buildAllowlist';
import logger from '../../lib/logger';

/**
 * @param filePath path in POSIX format
 */
export async function validatePathIsInAllowlist(filePath: string): Promise<boolean> {
  const allowlist = await buildAllowlist();

  // The pino destination is wrapped with wrapWithMasking, which replaces
  // the OS username (and other sensitive strings) with '******' before any
  // line reaches disk or stdout. No call-site masking is needed.
  logger.debug({
    allowlist,
    filePath,
  }, 'Validating path is in allowlist');

  return validatePathInAllowlistCore(filePath, allowlist);
}
