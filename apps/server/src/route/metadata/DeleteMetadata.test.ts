import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import type { MediaMetadata } from '@smm/types'

const mocks = vi.hoisted(() => ({
  deleteMetadata: vi.fn(),
}))

vi.mock('../../core/getCore', () => ({
  getCore: () => mocks,
}))

import { deleteMetadataRoute } from './DeleteMetadata'

const metadata: MediaMetadata = {
  mediaFolderPath: '/media/Show',
  type: 'tvshow-folder',
  mediaFiles: [],
}

describe('POST /api/delete-metadata', () => {
  let app: Hono

  beforeEach(() => {
    mocks.deleteMetadata.mockReset()
    app = deleteMetadataRoute
  })

  async function remove() {
    return app.request('/api/delete-metadata', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path: metadata.mediaFolderPath }),
    })
  }

  it('returns success when deleting metadata twice', async () => {
    mocks.deleteMetadata.mockResolvedValue(undefined)
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

  it('returns 500 internal ProblemDetails when the core delete fails', async () => {
    mocks.deleteMetadata.mockRejectedValue(new Error('boom'))

    const res = await remove()

    expect(res.status).toBe(500)
    expect(res.headers.get('content-type')).toContain('application/problem+json')
    expect(await res.json()).toMatchObject({
      type: 'urn:smm:problem:internal',
      status: 500,
      instance: '/api/delete-metadata',
    })
  })
})
