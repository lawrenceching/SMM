import { APP_VERSION } from '../src/version';
import type { HelloResponseBody } from '@core/types';
import { detectOsLocale } from '@core/locale';
import { getLogDir, getUserDataDir, getAppDataDir, getTmpDir } from '@/utils/config';
import { logger } from '../lib/logger';

export async function executeHelloTask(reverseProxyUrl: string | null = null): Promise<HelloResponseBody> {
  if (reverseProxyUrl === null) {
    logger.warn('Reverse proxy is not available — metadata API requests that depend on the local proxy may fail.');
  }
  return {
    uptime: process.uptime(),
    version: APP_VERSION,
    userDataDir: getUserDataDir(),
    appDataDir: getAppDataDir(),
    logDir: getLogDir(),
    tmpDir: getTmpDir(),
    reverseProxyUrl,
    osLocale: detectOsLocale(),
  }
}