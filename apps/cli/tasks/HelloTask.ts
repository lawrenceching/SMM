import { APP_VERSION } from '../src/version';
import type { HelloResponseBody } from '@core/types';
import { getLogDir, getUserDataDir, getAppDataDir } from '@/utils/config';

export async function executeHelloTask(): Promise<HelloResponseBody> {
  return {
    uptime: process.uptime(),
    version: APP_VERSION,
    userDataDir: getUserDataDir(),
    appDataDir: getAppDataDir(),
    logDir: getLogDir(),
  }
}