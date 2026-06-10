import { APP_VERSION } from '../src/version';
import type { HelloResponseBody } from '@core/types';
import { detectOsLocale } from '@core/locale';
import { doHello, type HelloOptions } from '@smm/core-routes';
import { getLogDir, getUserDataDir, getAppDataDir, getTmpDir } from '@/utils/config';
import { logger } from '../lib/logger';

export function buildHelloOptions(
  reverseProxyUrl: string | null = null,
): Omit<HelloOptions, "coreRoutesPort"> {
  return {
    version: APP_VERSION,
    userDataDir: getUserDataDir(),
    appDataDir: getAppDataDir(),
    logDir: getLogDir(),
    tmpDir: getTmpDir(),
    reverseProxyUrl,
    osLocale: detectOsLocale(),
  };
}

export async function executeHelloTask(reverseProxyUrl: string | null = null): Promise<HelloResponseBody> {
  if (reverseProxyUrl === null) {
    logger.warn('Reverse proxy is not available — metadata API requests that depend on the local proxy may fail.');
  }
  return doHello(buildHelloOptions(reverseProxyUrl));
}
