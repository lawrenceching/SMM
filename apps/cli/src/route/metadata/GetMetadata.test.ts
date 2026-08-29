import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { Hono } from 'hono'
import type { MediaMetadata } from '@core/types'
import { resetCoreForTests } from '../../core/getCore'
import { handleCreateMetadata } from './CreateMetadata'
import { handleDeleteMetadata } from './DeleteMetadata'
import { handleGetMetadata } from './GetMetadata'
import { handleSetMetadata } from './SetMetadata'

const metadata: MediaMetadata = {
  mediaFolderPath: '/media/Show',
  type: 'tvshow-folder',
  mediaFiles: [],
}

describe('POST /api/get-metadata', () => {
  let appDataDir: string
  let userDataDir: string
  let previousAppDataDir: string | undefined
  let previousUserDataDir: string | undefined
  let app: Hono

  beforeEach(() => {
    previousAppDataDir = process.env.APP_DATA_DIR
    previousUserDataDir = process.env.USER_DATA_DIR
    appDataDir = mkdtempSync(join(tmpdir(), 'smm-get-metadata-app-'))
    userDataDir = mkdtempSync(join(tmpdir(), 'smm-get-metadata-user-'))
    process.env.APP_DATA_DIR = appDataDir
    process.env.USER_DATA_DIR = userDataDir
    resetCoreForTests()
    app = new Hono()
    handleCreateMetadata(app)
    handleSetMetadata(app)
    handleDeleteMetadata(app)
    handleGetMetadata(app)
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

  it('returns 404 ProblemDetails when missing', async () => {
    const res = await app.request('/api/get-metadata', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path: '/no/such/folder' }),
    })

    expect(res.status).toBe(404)
    expect(res.headers.get('content-type')).toContain('application/problem+json')
    const body = (await res.json()) as { type: string }
    expect(body.type).toBe('urn:smm:problem:metadata-not-found')
  })

  it('supports create, get, set, get, and delete roundtrip', async () => {
    const post = (path: string, body: unknown) =>
      app.request(path, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })

    const create = await post('/api/create-metadata', { data: metadata })
    expect(create.status).toBe(200)
    expect(await create.json()).toEqual({ data: metadata })

    const firstGet = await post('/api/get-metadata', { path: metadata.mediaFolderPath })
    expect(firstGet.status).toBe(200)
    expect(await firstGet.json()).toEqual({ data: metadata })

    const set = await post('/api/set-metadata', {
      path: metadata.mediaFolderPath,
      patch: { type: 'movie-folder', movie: { database: 'TMDB', id: '2', name: 'Movie' } },
    })
    expect(set.status).toBe(200)

    const secondGet = await post('/api/get-metadata', { path: metadata.mediaFolderPath })
    expect(secondGet.status).toBe(200)
    expect(await secondGet.json()).toMatchObject({
      data: {
        mediaFolderPath: metadata.mediaFolderPath,
        type: 'movie-folder',
        movie: { database: 'TMDB', id: '2', name: 'Movie' },
      },
    })

    const remove = await post('/api/delete-metadata', { path: metadata.mediaFolderPath })
    expect(remove.status).toBe(200)
    expect(await remove.json()).toEqual({ data: true })
  })
})
