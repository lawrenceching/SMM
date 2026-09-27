import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { buildCliHostRuntimeConfig } from './hostRuntimeConfig'

describe('buildCliHostRuntimeConfig', () => {
  let previousUserDataDir: string | undefined
  let previousAppDataDir: string | undefined

  beforeEach(() => {
    previousUserDataDir = process.env.USER_DATA_DIR
    previousAppDataDir = process.env.APP_DATA_DIR
    process.env.USER_DATA_DIR = '/core/user-data'
    process.env.APP_DATA_DIR = '/metadata/app-data'
  })

  afterEach(() => {
    if (previousUserDataDir === undefined) delete process.env.USER_DATA_DIR
    else process.env.USER_DATA_DIR = previousUserDataDir
    if (previousAppDataDir === undefined) delete process.env.APP_DATA_DIR
    else process.env.APP_DATA_DIR = previousAppDataDir
  })

  it('keeps userDataDir and appDataDir distinct for Linux-style env overrides', () => {
    const host = buildCliHostRuntimeConfig()
    expect(host.userDataDir).toBe('/core/user-data')
    expect(host.appDataDir).toBe('/metadata/app-data')
    expect(host.version).toBeTruthy()
    expect(host.platform).toBe(process.platform)
  })
})
