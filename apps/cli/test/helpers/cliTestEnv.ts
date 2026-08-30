import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { resetCoreForTests } from '../../src/core/getCore'

export type CliTestEnv = {
  userDataDir: string
  appDataDir: string
  previousUserDataDir: string | undefined
  previousAppDataDir: string | undefined
}

/** Isolate user config (smm.json) and metadata cache (app data dir) for CLI tests. */
export function installCliTestEnv(prefix: string): CliTestEnv {
  const env: CliTestEnv = {
    previousUserDataDir: process.env.USER_DATA_DIR,
    previousAppDataDir: process.env.APP_DATA_DIR,
    userDataDir: mkdtempSync(join(tmpdir(), `${prefix}-user-`)),
    appDataDir: mkdtempSync(join(tmpdir(), `${prefix}-app-`)),
  }
  process.env.USER_DATA_DIR = env.userDataDir
  process.env.APP_DATA_DIR = env.appDataDir
  resetCoreForTests()
  return env
}

export function restoreCliTestEnv(env: CliTestEnv): void {
  resetCoreForTests()
  if (env.previousUserDataDir === undefined) delete process.env.USER_DATA_DIR
  else process.env.USER_DATA_DIR = env.previousUserDataDir
  if (env.previousAppDataDir === undefined) delete process.env.APP_DATA_DIR
  else process.env.APP_DATA_DIR = env.previousAppDataDir
  rmSync(env.userDataDir, { recursive: true, force: true })
  rmSync(env.appDataDir, { recursive: true, force: true })
}
