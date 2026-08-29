import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { Hono } from 'hono'
import type { MediaMetadata } from '@core/types'
import { resetCoreForTests } from '../../core/getCore'
import { handleCreateMetadata } from './CreateMetadata'

const metadata: MediaMetadata = {
  mediaFolderPath: '/media/Show',
  type: 'tvshow-folder',
  mediaFiles: [],
}

describe('POST /api/create-metadata', () => {
  let appDataDir: string
  let userDataDir: string
  let previousAppDataDir: string | undefined
  let previousUserDataDir: string | undefined
  let app: Hono

  beforeEach(() => {
    previousAppDataDir = process.env.APP_DATA_DIR
    previousUserDataDir = process.env.USER_DATA_DIR
    appDataDir = mkdtempSync(join(tmpdir(), 'smm-create-metadata-app-'))
    userDataDir = mkdtempSync(join(tmpdir(), 'smm-create-metadata-user-'))
    process.env.APP_DATA_DIR = appDataDir
    process.env.USER_DATA_DIR = userDataDir
    resetCoreForTests()
    app = new Hono()
    handleCreateMetadata(app)
  })

  afterEach(() => {
    resetCoreForTests()
    if (previousAppDataDir === undefined) delete process.env.APP_DATA_DIR
    else process.env.APP_DATA_DIR = previousAppDataDir
    if (previousUserDataDir === undefined) delete process.env.USER_DATA_DIR
    else process.env.USER_DATA_DIR = previousUserDataDir
    rmSync(appDataDir, { recursive: true, force: true })
    rmSync(userDataDir, { recursive: true, force: true })
  })

  async function create() {
    return app.request('/api/create-metadata', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ data: metadata }),
    })
  }

  it('returns 400 validation ProblemDetails for malformed JSON', async () => {
    const res = await app.request('/api/create-metadata', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"data":',
    })

    expect(res.status).toBe(400)
    expect(res.headers.get('content-type')).toContain('application/problem+json')
    expect(await res.json()).toMatchObject({
      type: 'urn:smm:problem:metadata-validation',
      status: 400,
      instance: '/api/create-metadata',
    })
  })

  it('returns 400 validation ProblemDetails when mediaFolderPath is missing', async () => {
    const res = await app.request('/api/create-metadata', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ data: { type: 'tvshow-folder' } }),
    })

    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({
      type: 'urn:smm:problem:metadata-validation',
      status: 400,
    })
  })

  it('returns 409 ProblemDetails when metadata already exists', async () => {
    expect((await create()).status).toBe(200)

    const res = await create()

    expect(res.status).toBe(409)
    expect(res.headers.get('content-type')).toContain('application/problem+json')
    const body = (await res.json()) as { type: string }
    expect(body.type).toBe('urn:smm:problem:metadata-already-exists')
  })
})
