import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { Hono } from 'hono'
import { handleImportLibrary } from './ImportLibrary'
import { handleGetJob } from './GetJob'
import { resetCoreForTests } from '../core/getCore'

describe('POST /api/import-library', () => {
  let userDataDir: string
  let libraryPath: string
  let prevUserDataDir: string | undefined
  let app: Hono

  beforeEach(() => {
    vi.restoreAllMocks()
    prevUserDataDir = process.env.USER_DATA_DIR
    userDataDir = mkdtempSync(join(tmpdir(), 'smm-import-library-'))
    libraryPath = mkdtempSync(join(tmpdir(), 'smm-import-library-path-'))
    process.env.USER_DATA_DIR = userDataDir
    resetCoreForTests()
    app = new Hono()
    handleImportLibrary(app)
    handleGetJob(app)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    resetCoreForTests()
    if (prevUserDataDir === undefined) delete process.env.USER_DATA_DIR
    else process.env.USER_DATA_DIR = prevUserDataDir
    rmSync(userDataDir, { recursive: true, force: true })
    rmSync(libraryPath, { recursive: true, force: true })
  })

  async function post(body: unknown) {
    return app.request('/api/import-library', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  async function getJob(id: string) {
    return app.request('/api/get-job', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
  }

  it('returns Error Reason when path is missing', async () => {
    const res = await post({ type: 'music' })
    expect(res.status).toBe(200)
    const json = (await res.json()) as { error?: string }
    expect(json.error).toMatch(/^Error Reason: path is required/)
  })

  it('returns Error Reason when type is missing', async () => {
    const res = await post({ path: '/media/lib' })
    expect(res.status).toBe(200)
    const json = (await res.json()) as { error?: string }
    expect(json.error).toMatch(/^Error Reason: type is required/)
  })

  it('returns a job id for import-library', async () => {
    const res = await post({ path: libraryPath, type: 'music', skipInit: true })
    expect(res.status).toBe(200)
    const json = (await res.json()) as { data?: { id: string }; error?: string }
    expect(json.error).toBeUndefined()
    expect(json.data?.id).toEqual(expect.any(String))

    const deadline = Date.now() + 5000
    let status: string | undefined
    while (Date.now() < deadline) {
      const jobRes = await getJob(json.data!.id)
      const jobJson = (await jobRes.json()) as { data?: { kind: string; status: string } }
      expect(jobJson.data?.kind).toBe('import-library')
      status = jobJson.data?.status
      if (status === 'succeeded' || status === 'failed') break
      await new Promise((r) => setTimeout(r, 50))
    }
    expect(status).toBe('succeeded')
  })
})
