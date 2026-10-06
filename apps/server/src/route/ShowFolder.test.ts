import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { Hono } from 'hono'
import { handleShowFolder } from './ShowFolder'
import { handleImportFolder } from './ImportFolder'
import { handleGetJob } from './GetJob'
import { resetCoreForTests } from '../core/getCore'

describe('POST /api/show-folder', () => {
  let userDataDir: string
  let mediaFolder: string
  let prevUserDataDir: string | undefined
  let app: Hono

  beforeEach(() => {
    prevUserDataDir = process.env.USER_DATA_DIR
    userDataDir = mkdtempSync(join(tmpdir(), 'smm-show-folder-'))
    mediaFolder = mkdtempSync(join(tmpdir(), 'smm-show-folder-media-'))
    process.env.USER_DATA_DIR = userDataDir
    resetCoreForTests()
    app = new Hono()
    handleImportFolder(app)
    handleGetJob(app)
    handleShowFolder(app)
  })

  afterEach(() => {
    resetCoreForTests()
    if (prevUserDataDir === undefined) delete process.env.USER_DATA_DIR
    else process.env.USER_DATA_DIR = prevUserDataDir
    rmSync(userDataDir, { recursive: true, force: true })
    rmSync(mediaFolder, { recursive: true, force: true })
  })

  async function postShow(body: unknown) {
    return app.request('/api/show-folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  async function waitForImport(path: string, type: string) {
    const res = await app.request('/api/import-folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, type }),
    })
    const json = (await res.json()) as { data?: { id: string }; error?: string }
    expect(json.error).toBeUndefined()
    const id = json.data!.id
    const deadline = Date.now() + 10_000
    while (Date.now() < deadline) {
      const jobRes = await app.request('/api/get-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      const job = (await jobRes.json()) as { data?: { status: string } }
      if (job.data?.status === 'succeeded' || job.data?.status === 'failed') {
        expect(job.data.status).toBe('succeeded')
        return
      }
      await new Promise((r) => setTimeout(r, 20))
    }
    throw new Error('timeout waiting for import')
  }

  it('returns Error Reason when path is missing', async () => {
    const res = await postShow({})
    expect(res.status).toBe(200)
    const json = (await res.json()) as { error?: string }
    expect(json.error).toMatch(/^Error Reason: path is required/)
  })

  it('returns Error Reason when the folder is not imported', async () => {
    const res = await postShow({ path: mediaFolder })
    expect(res.status).toBe(200)
    const json = (await res.json()) as { error?: string }
    expect(json.error).toMatch(/not imported/i)
  })

  it('returns ok with type after a successful music import', async () => {
    writeFileSync(join(mediaFolder, 'track.mp3'), 'x')
    await waitForImport(mediaFolder, 'music')

    const res = await postShow({ path: mediaFolder })
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      data: {
        path: mediaFolder,
        status: 'ok',
        type: 'music-folder',
      },
    })
  })
})
