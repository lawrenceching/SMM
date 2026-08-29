import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { Hono } from 'hono'
import type { MediaMetadata } from '@core/types'
import { getCore, resetCoreForTests } from '../../core/getCore'
import { handleSetMetadata } from './SetMetadata'

const metadata: MediaMetadata = {
  mediaFolderPath: '/media/Show',
  type: 'tvshow-folder',
  mediaFiles: [],
}

describe('POST /api/set-metadata', () => {
  let appDataDir: string
  let userDataDir: string
  let previousAppDataDir: string | undefined
  let previousUserDataDir: string | undefined
  let app: Hono

  beforeEach(async () => {
    previousAppDataDir = process.env.APP_DATA_DIR
    previousUserDataDir = process.env.USER_DATA_DIR
    appDataDir = mkdtempSync(join(tmpdir(), 'smm-set-metadata-app-'))
    userDataDir = mkdtempSync(join(tmpdir(), 'smm-set-metadata-user-'))
    process.env.APP_DATA_DIR = appDataDir
    process.env.USER_DATA_DIR = userDataDir
    resetCoreForTests()
    app = new Hono()
    handleSetMetadata(app)
    await getCore().createMetadata(metadata)
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

  it('returns 400 ProblemDetails for an illegal patch field', async () => {
    const res = await app.request('/api/set-metadata', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        path: metadata.mediaFolderPath,
        patch: { mediaFolderPath: '/media/Other' },
      }),
    })

    expect(res.status).toBe(400)
    expect(res.headers.get('content-type')).toContain('application/problem+json')
    const body = (await res.json()) as { type: string }
    expect(body.type).toBe('urn:smm:problem:metadata-validation')
  })
})
