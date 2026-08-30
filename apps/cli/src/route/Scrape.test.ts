import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { Hono } from 'hono'
import { handleScrape } from './Scrape'
import { handleGetJob } from './GetJob'
import { handleImportFolder } from './ImportFolder'
import { getCore, resetCoreForTests } from '../core/getCore'
import { Path } from '@smm/utils/path'
import type { MediaMetadata } from '@smm/types'

describe('POST /api/scrape', () => {
  let userDataDir: string
  let prevUserDataDir: string | undefined
  let app: Hono

  beforeEach(() => {
    prevUserDataDir = process.env.USER_DATA_DIR
    userDataDir = mkdtempSync(join(tmpdir(), 'smm-scrape-route-'))
    process.env.USER_DATA_DIR = userDataDir
    resetCoreForTests()
    app = new Hono()
    handleImportFolder(app)
    handleScrape(app)
    handleGetJob(app)
  })

  afterEach(() => {
    resetCoreForTests()
    if (prevUserDataDir === undefined) delete process.env.USER_DATA_DIR
    else process.env.USER_DATA_DIR = prevUserDataDir
    rmSync(userDataDir, { recursive: true, force: true })
  })

  async function postScrape(body: unknown) {
    return app.request('/api/scrape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  it('returns Error Reason when path is missing', async () => {
    const res = await postScrape({})
    expect(res.status).toBe(200)
    const json = (await res.json()) as { error?: string }
    expect(json.error).toMatch(/^Error Reason: path is required/)
  })

  it('returns Error Reason when the folder is not managed', async () => {
    const res = await postScrape({ path: '/media/not-managed' })
    expect(res.status).toBe(200)
    const json = (await res.json()) as { error?: string; data?: unknown }
    expect(json.data).toBeUndefined()
    expect(json.error).toMatch(/^Error Reason: .*is not managed by SMM/)
  })

  it('returns a scrape job id and get-job includes kind scrape', async () => {
    const folderPath = join(userDataDir, 'show')
    const imported = await app.request('/api/import-folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: folderPath, type: 'tvshow', skipInit: true }),
    })
    expect(imported.status).toBe(200)
    const importJson = (await imported.json()) as { data?: { id: string }; error?: string }
    expect(importJson.error).toBeUndefined()

    const importJobId = importJson.data!.id
    const deadline = Date.now() + 2000
    let importStatus: string | undefined
    while (Date.now() < deadline) {
      const jobRes = await app.request('/api/get-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: importJobId }),
      })
      const jobJson = (await jobRes.json()) as { data?: { status: string } }
      importStatus = jobJson.data?.status
      if (importStatus === 'succeeded' || importStatus === 'failed') break
      await new Promise((r) => setTimeout(r, 20))
    }
    expect(importStatus).toBe('succeeded')

    const posixPath = Path.posix(folderPath)
    const metadata: MediaMetadata = {
      type: 'tvshow-folder',
      mediaFolderPath: posixPath,
      mediaFiles: [],
      tvShow: {
        database: 'TMDB',
        id: '1',
        name: 'Test Show',
        seasons: [],
      },
    }
    await getCore().setMetadata(posixPath, {
      type: metadata.type,
      mediaFiles: metadata.mediaFiles,
      tvShow: metadata.tvShow,
    })

    const res = await postScrape({ path: folderPath })
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
      data?: { kind?: string; id?: string; tasks?: Record<string, unknown> }
      error?: string
    }
    expect(jobJson.error).toBeUndefined()
    expect(jobJson.data?.kind).toBe('scrape')
    expect(jobJson.data?.id).toBe(json.data!.id)
    expect(jobJson.data?.tasks).toBeDefined()
  })
})
