import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { Hono } from 'hono'
import { handleGetJobLog } from './GetJobLog'
import { importFolderRoute } from './ImportFolder'
import { resetCoreForTests } from '../core/getCore'
import { logger } from '../../lib/logger'

describe('POST /api/get-job-log', () => {
  let userDataDir: string
  let prevUserDataDir: string | undefined
  let app: Hono

  beforeEach(() => {
    prevUserDataDir = process.env.USER_DATA_DIR
    userDataDir = mkdtempSync(join(tmpdir(), 'smm-get-job-log-'))
    process.env.USER_DATA_DIR = userDataDir
    resetCoreForTests()
    const base = new Hono()
    handleGetJobLog(base)
    app = base.route('/', importFolderRoute)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    resetCoreForTests()
    if (prevUserDataDir === undefined) delete process.env.USER_DATA_DIR
    else process.env.USER_DATA_DIR = prevUserDataDir
    rmSync(userDataDir, { recursive: true, force: true })
  })

  it('returns Error Reason when id is missing', async () => {
    const res = await app.request('/api/get-job-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(200)
    const json = (await res.json()) as { error?: string }
    expect(json.error).toMatch(/^Error Reason: id is required/)
  })

  it('returns Error Reason when the job is unknown', async () => {
    const loggerError = vi.spyOn(logger, 'error').mockImplementation(() => undefined)
    const res = await app.request('/api/get-job-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'missing' }),
    })
    expect(res.status).toBe(200)
    const json = (await res.json()) as { error?: string }
    expect(json.error).toMatch(/^Error Reason: Job not found/)
    expect(loggerError).not.toHaveBeenCalled()
  })

  it('returns log lines after skipInit import', async () => {
    const imported = await app.request('/api/import-folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '/media/A', type: 'music', skipInit: true }),
    })
    const { data } = (await imported.json()) as { data: { id: string } }
    const deadline = Date.now() + 5000
    let lines: string[] | undefined
    while (Date.now() < deadline) {
      const res = await app.request('/api/get-job-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: data.id }),
      })
      expect(res.status).toBe(200)
      const json = (await res.json()) as { data?: { lines: { message: string }[] }; error?: string }
      if (json.data?.lines.some((l) => /^\S+ completed$/.test(l.message))) {
        lines = json.data.lines.map((l) => l.message)
        break
      }
      await new Promise((r) => setTimeout(r, 20))
    }
    expect(lines).toEqual(expect.arrayContaining([
      'Started to import folder: /media/A, type: music',
      expect.stringMatching(/^\S+ completed$/),
    ]))
  })
})
