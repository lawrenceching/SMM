import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRemoteMetadata, patchRemoteUserConfigFolders } from './remoteHttp'

describe('remoteHttp', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('patchRemoteUserConfigFolders posts JSON Patch with Bearer', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { folders: ['/tmp/x'] }, error: null }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await patchRemoteUserConfigFolders('http://127.0.0.1:30000', 'tok', ['/tmp/x'])

    expect(fetchMock.mock.calls[0]?.[0]).toBe('http://127.0.0.1:30000/api/patchUserConfig')
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: 'POST',
      headers: {
        Authorization: 'Bearer tok',
        'Content-Type': 'application/json',
      },
    })
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))
    expect(body.patch).toEqual([{ op: 'replace', path: '/folders', value: ['/tmp/x'] }])
  })

  it('createRemoteMetadata posts data payload', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { mediaFolderPath: '/tmp/x' } }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await createRemoteMetadata('http://127.0.0.1:30000', 'tok', {
      mediaFolderPath: '/tmp/x',
      type: 'movie-folder',
    } as never)

    expect(fetchMock.mock.calls[0]?.[0]).toBe('http://127.0.0.1:30000/api/create-metadata')
  })
})
