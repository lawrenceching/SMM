import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { Hono } from 'hono'
import { scrapeRoute } from './Scrape'
import { getJobRoute } from './GetJob'
import { getCore, resetCoreForTests } from '../core/getCore'
import { Path } from '@smm/utils/path'
import type { MediaMetadata } from '@smm/types'

describe('POST /api/scrape', () => {
  let userDataDir: string
  let appDataDir: string
  let prevUserDataDir: string | undefined
  let prevAppDataDir: string | undefined
  let app: Hono

  beforeEach(() => {
    prevUserDataDir = process.env.USER_DATA_DIR
    prevAppDataDir = process.env.APP_DATA_DIR
    userDataDir = mkdtempSync(join(tmpdir(), 'smm-scrape-route-'))
    appDataDir = mkdtempSync(join(tmpdir(), 'smm-scrape-route-app-'))
    process.env.USER_DATA_DIR = userDataDir
    process.env.APP_DATA_DIR = appDataDir
    resetCoreForTests()
    app = new Hono()
    app.route('/', scrapeRoute)
    app.route('/', getJobRoute)
  })

  afterEach(() => {
    resetCoreForTests()
    if (prevUserDataDir === undefined) delete process.env.USER_DATA_DIR
    else process.env.USER_DATA_DIR = prevUserDataDir
    if (prevAppDataDir === undefined) delete process.env.APP_DATA_DIR
    else process.env.APP_DATA_DIR = prevAppDataDir
    rmSync(userDataDir, { recursive: true, force: true })
    rmSync(appDataDir, { recursive: true, force: true })
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
    await getCore().setUserConfigKey('folders', [posixPath])
    await getCore().createMetadata(metadata)

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
