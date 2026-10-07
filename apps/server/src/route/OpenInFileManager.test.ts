import { afterEach, describe, expect, it, vi } from 'vitest'
import os from 'os'
import { openInFileManagerRoute } from './OpenInFileManager'

describe('POST /api/openInFileManager', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  async function post(body: unknown) {
    return openInFileManagerRoute.request('/api/openInFileManager', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  it('returns 400 route-owned error when path is missing', async () => {
    vi.spyOn(os, 'platform').mockReturnValue('win32')
    const res = await post({})
    expect(res.status).toBe(400)
    const json = (await res.json()) as { data?: { path?: string }; error?: string }
    expect(json.error).toBe('Path is required and must be a string')
    expect(json.data?.path).toBe('')
  })

  it('returns 400 route-owned error when the folder does not exist', async () => {
    vi.spyOn(os, 'platform').mockReturnValue('win32')
    const res = await post({ path: 'Z:/__smm_missing_dir__/not/here' })
    expect(res.status).toBe(400)
    const json = (await res.json()) as { data?: { path?: string }; error?: string }
    expect(json.error).toMatch(/^Path does not exist:/)
  })

  it('returns 500 for a malformed JSON body', async () => {
    const res = await openInFileManagerRoute.request('/api/openInFileManager', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    })
    expect(res.status).toBe(500)
  })
})
