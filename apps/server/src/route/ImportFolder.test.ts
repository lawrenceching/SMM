import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { Hono } from 'hono'
import { importFolderRoute } from './ImportFolder'
import { resetCoreForTests } from '../core/getCore'

describe('POST /api/import-folder', () => {
  let userDataDir: string
  let prevUserDataDir: string | undefined
  let app: Hono

  beforeEach(() => {
    prevUserDataDir = process.env.USER_DATA_DIR
    userDataDir = mkdtempSync(join(tmpdir(), 'smm-import-folder-'))
    process.env.USER_DATA_DIR = userDataDir
    resetCoreForTests()
    app = importFolderRoute
  })

  afterEach(() => {
    resetCoreForTests()
    if (prevUserDataDir === undefined) delete process.env.USER_DATA_DIR
    else process.env.USER_DATA_DIR = prevUserDataDir
    rmSync(userDataDir, { recursive: true, force: true })
  })

  async function post(body: unknown) {
    return app.request('/api/import-folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  it('returns Error Reason when path is missing', async () => {
    const res = await post({ type: 'music' })
    expect(res.status).toBe(200)
    const json = (await res.json()) as { error?: string }
    expect(json.error).toMatch(/^Error Reason: path is required/)
  })

  it('returns Error Reason when type is missing', async () => {
    const res = await post({ path: '/media/A' })
    expect(res.status).toBe(200)
    const json = (await res.json()) as { error?: string }
    expect(json.error).toMatch(/^Error Reason: type is required/)
  })

  it('with skipInit registers the folder and returns a job id', async () => {
    const res = await post({ path: '/media/A', type: 'tvshow', skipInit: true })
    expect(res.status).toBe(200)
    const json = (await res.json()) as { data?: { id: string }; error?: string }
    expect(json.error).toBeUndefined()
    expect(json.data?.id).toEqual(expect.any(String))

    const smmPath = join(userDataDir, 'smm.json')
    const deadline = Date.now() + 5000
    let saved: { folders: string[] } | undefined
    while (Date.now() < deadline) {
      try {
        saved = JSON.parse(readFileSync(smmPath, 'utf-8')) as { folders: string[] }
        if (saved.folders.includes('/media/A')) break
      } catch {
        /* job still writing */
      }
      await new Promise((r) => setTimeout(r, 20))
    }
    expect(saved?.folders).toContain('/media/A')
  })
})
