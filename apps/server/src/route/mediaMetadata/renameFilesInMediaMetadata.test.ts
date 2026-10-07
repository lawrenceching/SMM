import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'

const mocks = vi.hoisted(() => ({
  updateMediaMetadataAndBroadcast: vi.fn(),
}))

vi.mock('../../utils/renameFileUtils', () => ({
  updateMediaMetadataAndBroadcast: mocks.updateMediaMetadataAndBroadcast,
}))

import { renameFilesInMediaMetadataRoute } from './renameFilesInMediaMetadata'

describe('POST /api/renameFilesInMediaMetadata', () => {
  let app: Hono

  beforeEach(() => {
    mocks.updateMediaMetadataAndBroadcast.mockReset()
    app = renameFilesInMediaMetadataRoute
  })

  async function post(body: unknown) {
    return app.request('/api/renameFilesInMediaMetadata', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  it('returns 200 error body when mediaFolder is missing', async () => {
    const res = await post({ files: [{ from: '/a.mkv', to: '/b.mkv' }] })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      error: 'Invalid Request: mediaFolder is required',
    })
    expect(mocks.updateMediaMetadataAndBroadcast).not.toHaveBeenCalled()
  })

  it('updates media metadata and echoes successful renames', async () => {
    mocks.updateMediaMetadataAndBroadcast.mockResolvedValue({ success: true })

    const res = await post({
      mediaFolder: '/media/Show',
      files: [{ from: '/media/Show/a.mkv', to: '/media/Show/b.mkv' }],
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      data: { successfulRenames: [{ from: '/media/Show/a.mkv', to: '/media/Show/b.mkv' }] },
    })
    expect(mocks.updateMediaMetadataAndBroadcast).toHaveBeenCalledWith(
      '/media/Show',
      [{ from: '/media/Show/a.mkv', to: '/media/Show/b.mkv' }],
      { dryRun: false, clientId: undefined, logPrefix: '[renameFilesInMediaMetadata]' },
    )
  })

  it('returns 200 error body when the metadata update fails', async () => {
    mocks.updateMediaMetadataAndBroadcast.mockResolvedValue({
      success: false,
      error: 'rename failed',
    })

    const res = await post({
      mediaFolder: '/media/Show',
      files: [{ from: '/a.mkv', to: '/b.mkv' }],
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ error: 'rename failed' })
  })
})
