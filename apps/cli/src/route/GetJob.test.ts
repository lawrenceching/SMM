import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { Hono } from 'hono'
import { handleGetJob } from './GetJob'
import { handleImportFolder } from './ImportFolder'
import { resetCoreForTests } from '../core/getCore'

describe('POST /api/get-job', () => {
  let userDataDir: string
  let prevUserDataDir: string | undefined
  let app: Hono

  beforeEach(() => {
    prevUserDataDir = process.env.USER_DATA_DIR
    userDataDir = mkdtempSync(join(tmpdir(), 'smm-get-job-'))
    process.env.USER_DATA_DIR = userDataDir
    resetCoreForTests()
    app = new Hono()
    handleImportFolder(app)
    handleGetJob(app)
  })

  afterEach(() => {
    resetCoreForTests()
    if (prevUserDataDir === undefined) delete process.env.USER_DATA_DIR
    else process.env.USER_DATA_DIR = prevUserDataDir
    rmSync(userDataDir, { recursive: true, force: true })
  })

  it('returns Error Reason when id is missing', async () => {
    const res = await app.request('/api/get-job', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(200)
    const json = (await res.json()) as { error?: string }
    expect(json.error).toMatch(/^Error Reason: id is required/)
  })

  it('returns Error Reason when the job is unknown', async () => {
    const res = await app.request('/api/get-job', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'missing' }),
    })
    expect(res.status).toBe(200)
    const json = (await res.json()) as { error?: string }
    expect(json.error).toMatch(/^Error Reason: Job not found/)
  })

  it('returns the import job after import-folder', async () => {
    const imported = await app.request('/api/import-folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '/media/A', type: 'music', skipInit: true }),
    })
    const { data } = (await imported.json()) as { data: { id: string } }

    const deadline = Date.now() + 2000
    let job: { status?: string; id?: string } | undefined
    while (Date.now() < deadline) {
      const res = await app.request('/api/get-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: data.id }),
      })
      const json = (await res.json()) as { data?: { id: string; status: string } }
      job = json.data
      if (job?.status === 'succeeded' || job?.status === 'failed') break
      await new Promise((r) => setTimeout(r, 20))
    }
    expect(job?.id).toBe(data.id)
    expect(job?.status).toBe('succeeded')
  })
})
