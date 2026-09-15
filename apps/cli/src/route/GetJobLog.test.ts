import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { Hono } from 'hono'
import { handleGetJobLog } from './GetJobLog'
import { handleImportFolder } from './ImportFolder'
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
    app = new Hono()
    handleImportFolder(app)
    handleGetJobLog(app)
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
    const res = await app.request('/api/get-job-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: data.id }),
    })
    expect(res.status).toBe(200)
    const json = (await res.json()) as { data?: { lines: { message: string }[] } }
    expect(json.data?.lines.map((l) => l.message)).toEqual([
      'persisted folder',
      'skipped init',
    ])
  })
})
