import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { Hono } from 'hono'
import { handleGetFolders } from './GetFolders'
import { resetCoreForTests } from '../core/getCore'

describe('POST /api/get-folders', () => {
  let userDataDir: string
  let prevUserDataDir: string | undefined
  let app: Hono

  beforeEach(() => {
    prevUserDataDir = process.env.USER_DATA_DIR
    userDataDir = mkdtempSync(join(tmpdir(), 'smm-get-folders-'))
    process.env.USER_DATA_DIR = userDataDir
    resetCoreForTests()
    app = new Hono()
    handleGetFolders(app)
  })

  afterEach(() => {
    resetCoreForTests()
    if (prevUserDataDir === undefined) delete process.env.USER_DATA_DIR
    else process.env.USER_DATA_DIR = prevUserDataDir
    rmSync(userDataDir, { recursive: true, force: true })
  })

  it('returns empty folders when smm.json is missing', async () => {
    const res = await app.request('/api/get-folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ data: { folders: [] } })
  })

  it('returns folders from smm.json', async () => {
    writeFileSync(
      join(userDataDir, 'smm.json'),
      JSON.stringify({ folders: ['/media/A', '/media/B'] }),
      'utf-8',
    )
    resetCoreForTests()
    const res = await app.request('/api/get-folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      data: { folders: ['/media/A', '/media/B'] },
    })
  })
})
