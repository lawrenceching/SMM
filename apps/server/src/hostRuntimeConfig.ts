import type { HostRuntimeConfig } from '@smm/types'
import { detectOsLocale } from '@smm/utils/locale'
import {
  getAppDataDir,
  getLogDir,
  getTmpDir,
  getUserDataDir,
} from '@server/utils/config'
import { APP_VERSION } from '@server/version'

/**
 * Single source of CLI host paths/version for Core and core-routes.
 * Call once per process bootstrap (or whenever env dirs change in tests).
 */
export function buildCliHostRuntimeConfig(): HostRuntimeConfig {
  return {
    version: APP_VERSION,
    userDataDir: getUserDataDir(),
    appDataDir: getAppDataDir(),
    tmpDir: getTmpDir(),
    logDir: getLogDir(),
    platform: process.platform,
    osLocale: detectOsLocale(),
  }
}
