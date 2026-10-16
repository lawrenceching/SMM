import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { Hono } from 'hono'
import type { CommandPort, CommandRunResult } from '@smm/core'
import { downloadVideoRoute } from './DownloadVideo'
import { getJobRoute } from './GetJob'
import { getJobsRoute } from './GetJobs'
import { getCore, resetCoreForTests } from '../core/getCore'

describe('POST /api/download-video', () => {
  let userDataDir: string
  let prevUserDataDir: string | undefined
  let app: Hono

  beforeEach(() => {
    prevUserDataDir = process.env.USER_DATA_DIR
    userDataDir = mkdtempSync(join(tmpdir(), 'smm-download-video-'))
    process.env.USER_DATA_DIR = userDataDir
    resetCoreForTests()

    const command: CommandPort = {
      run: vi.fn(async (): Promise<CommandRunResult> => ({
        exitCode: 0,
        stdout: '',
        stderr: '',
      })),
    }
    getCore({ _ports: { command } })

    const base = new Hono()
    base.route('/', downloadVideoRoute)
    base.route('/', getJobRoute)
    base.route('/', getJobsRoute)
    app = base
  })

  afterEach(() => {
    resetCoreForTests()
    if (prevUserDataDir === undefined) delete process.env.USER_DATA_DIR
    else process.env.USER_DATA_DIR = prevUserDataDir
    rmSync(userDataDir, { recursive: true, force: true })
  })

  async function postDownload(body: unknown) {
    return app.request('/api/download-video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  it('returns Error Reason when url is missing', async () => {
    const res = await postDownload({ folder: '/downloads' })
    expect(res.status).toBe(200)
    const json = (await res.json()) as { error?: string }
    expect(json.error).toMatch(/^Error Reason: url is required/)
  })

  it('returns a job id and get-job kind ytdlp', async () => {
    const res = await postDownload({
      url: 'https://www.bilibili.com/video/BV1',
      folder: '/downloads',
      title: 'Demo',
    })
    expect(res.status).toBe(200)
    const json = (await res.json()) as { data?: { id: string }; error?: string }
    expect(json.error).toBeUndefined()
    expect(json.data?.id).toEqual(expect.any(String))

    const jobRes = await app.request('/api/get-job', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: json.data!.id }),
    })
    const jobJson = (await jobRes.json()) as {
      data?: { kind?: string; type?: string; url?: string }
    }
    expect(jobJson.data?.kind).toBe('ytdlp')
    expect(jobJson.data?.type).toBe('ytdlp')
    expect(jobJson.data?.url).toContain('bilibili')

    const jobsRes = await app.request('/api/get-jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })
    const jobsJson = (await jobsRes.json()) as {
      data?: { jobs: Array<{ id: string; kind?: string }> }
    }
    expect(jobsJson.data?.jobs.some((j) => j.id === json.data!.id && j.kind === 'ytdlp')).toBe(
      true,
    )
  })

  it('rejects YouTube without cookies', async () => {
    const res = await postDownload({
      url: 'https://www.youtube.com/watch?v=abc',
      folder: '/downloads',
    })
    expect(res.status).toBe(200)
    const json = (await res.json()) as { error?: string }
    expect(json.error).toMatch(/cookies/i)
  })
})
