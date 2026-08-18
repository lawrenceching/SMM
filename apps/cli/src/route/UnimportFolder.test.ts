import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { Hono } from 'hono'
import { handleUnimportFolder } from './UnimportFolder'
import { resetCoreForTests } from '../core/getCore'

describe('POST /api/unimport-folder', () => {
  let userDataDir: string
  let prevUserDataDir: string | undefined
  let app: Hono

  beforeEach(() => {
    prevUserDataDir = process.env.USER_DATA_DIR
    userDataDir = mkdtempSync(join(tmpdir(), 'smm-unimport-folder-'))
    process.env.USER_DATA_DIR = userDataDir
    resetCoreForTests()
    app = new Hono()
    handleUnimportFolder(app)
  })

  afterEach(() => {
    resetCoreForTests()
    if (prevUserDataDir === undefined) delete process.env.USER_DATA_DIR
    else process.env.USER_DATA_DIR = prevUserDataDir
    rmSync(userDataDir, { recursive: true, force: true })
  })

  async function post(body: unknown) {
    return app.request('/api/unimport-folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  it('removes the folder from smm.json and deletes metadata cache', async () => {
    writeFileSync(
      join(userDataDir, 'smm.json'),
      JSON.stringify({ folders: ['/media/A', '/media/B'] }),
      'utf-8',
    )
    const cacheDir = join(userDataDir, 'metadata')
    mkdirSync(cacheDir, { recursive: true })
    const cacheFile = join(cacheDir, '_media_A.json')
    writeFileSync(cacheFile, JSON.stringify({ mediaFolderPath: '/media/A' }), 'utf-8')
    resetCoreForTests()

    const res = await post({ path: '/media/A' })
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ data: { path: '/media/A' } })

    const saved = JSON.parse(readFileSync(join(userDataDir, 'smm.json'), 'utf-8')) as { folders: string[] }
    expect(saved.folders).toEqual(['/media/B'])
    expect(existsSync(cacheFile)).toBe(false)
  })

  it('succeeds when the folder is not imported', async () => {
    writeFileSync(
      join(userDataDir, 'smm.json'),
      JSON.stringify({ folders: ['/media/Keep'] }),
      'utf-8',
    )
    resetCoreForTests()

    const res = await post({ path: '/media/Missing' })
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ data: { path: '/media/Missing' } })

    const saved = JSON.parse(readFileSync(join(userDataDir, 'smm.json'), 'utf-8')) as { folders: string[] }
    expect(saved.folders).toEqual(['/media/Keep'])
  })

  it('returns Error Reason when path is missing', async () => {
    const res = await post({})
    expect(res.status).toBe(200)
    const json = (await res.json()) as { error?: string }
    expect(json.error).toMatch(/^Error Reason: path is required/)
  })
})
