import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { Hono } from 'hono'
import type { MediaMetadata } from '@smm/types'
import { getCore, resetCoreForTests } from '../../core/getCore'
import { deleteMetadataRoute } from './DeleteMetadata'

const metadata: MediaMetadata = {
  mediaFolderPath: '/media/Show',
  type: 'tvshow-folder',
  mediaFiles: [],
}

describe('POST /api/delete-metadata', () => {
  let appDataDir: string
  let userDataDir: string
  let previousAppDataDir: string | undefined
  let previousUserDataDir: string | undefined
  let app: Hono

  beforeEach(async () => {
    previousAppDataDir = process.env.APP_DATA_DIR
    previousUserDataDir = process.env.USER_DATA_DIR
    appDataDir = mkdtempSync(join(tmpdir(), 'smm-delete-metadata-app-'))
    userDataDir = mkdtempSync(join(tmpdir(), 'smm-delete-metadata-user-'))
    process.env.APP_DATA_DIR = appDataDir
    process.env.USER_DATA_DIR = userDataDir
    resetCoreForTests()
    app = deleteMetadataRoute
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

  async function remove() {
    return app.request('/api/delete-metadata', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path: metadata.mediaFolderPath }),
    })
  }

  it('returns success when deleting metadata twice', async () => {
    for (const res of [await remove(), await remove()]) {
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ data: true })
    }
  })

  it('returns 400 validation ProblemDetails when path is missing', async () => {
    const res = await app.request('/api/delete-metadata', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    })

    expect(res.status).toBe(400)
    expect(res.headers.get('content-type')).toContain('application/problem+json')
    expect(await res.json()).toMatchObject({
      type: 'urn:smm:problem:metadata-validation',
      status: 400,
      instance: '/api/delete-metadata',
    })
  })
})
