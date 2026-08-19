import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { resetCoreForTests, smm } from './helpers/smm'

describe('smm config CLI e2e', () => {
  let userDataDir: string
  let prevUserDataDir: string | undefined

  beforeEach(() => {
    prevUserDataDir = process.env.USER_DATA_DIR
    userDataDir = mkdtempSync(join(tmpdir(), 'smm-cli-config-e2e-'))
    process.env.USER_DATA_DIR = userDataDir
    resetCoreForTests()
  })

  afterEach(() => {
    resetCoreForTests()
    if (prevUserDataDir === undefined) delete process.env.USER_DATA_DIR
    else process.env.USER_DATA_DIR = prevUserDataDir
    rmSync(userDataDir, { recursive: true, force: true })
  })

  it('lists the full user config as JSON', async () => {
    const listed = await smm(['config', 'list'])
    expect(listed.code).toBe(0)
    const config = JSON.parse(listed.stdout) as { dryRun: boolean; folders: string[] }
    expect(config.dryRun).toBe(false)
    expect(config.folders).toEqual([])
  })

  it('sets a key, gets the JSON value, and shows it in list', async () => {
    const set = await smm(['config', 'set', 'dryRun', 'true'])
    expect(set.code, set.stderr).toBe(0)
    expect(JSON.parse(set.stdout)).toBe(true)

    const got = await smm(['config', 'get', 'dryRun'])
    expect(got.code, got.stderr).toBe(0)
    expect(JSON.parse(got.stdout)).toBe(true)

    const listed = await smm(['config', 'list'])
    expect(listed.code).toBe(0)
    expect(JSON.parse(listed.stdout).dryRun).toBe(true)
  })

  it('stores a non-JSON value as a string', async () => {
    const set = await smm(['config', 'set', 'selectedRenameRule', 'plex'])
    expect(set.code, set.stderr).toBe(0)
    expect(JSON.parse(set.stdout)).toBe('plex')

    const got = await smm(['config', 'get', 'selectedRenameRule'])
    expect(got.code, got.stderr).toBe(0)
    expect(JSON.parse(got.stdout)).toBe('plex')
  })

  it('exits 1 when getting an unknown key', async () => {
    const got = await smm(['config', 'get', 'notAKey'])
    expect(got.code).toBe(1)
    expect(got.stderr).toContain('Unknown config key: notAKey')
  })

  it('exits 1 when setting an unknown key', async () => {
    const set = await smm(['config', 'set', 'notAKey', '1'])
    expect(set.code).toBe(1)
    expect(set.stderr).toContain('Unknown config key: notAKey')
  })
})
