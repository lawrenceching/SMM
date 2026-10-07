import { describe, expect, it } from 'vitest'
import { openFileRoute } from './OpenFile'

describe('POST /api/openFile', () => {
  async function post(body: unknown) {
    return openFileRoute.request('/api/openFile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  it('returns in-band validation error when path is missing', async () => {
    const res = await post({})
    expect(res.status).toBe(200)
    const json = (await res.json()) as { data?: { path?: string }; error?: string }
    expect(json.error).toBe('Validation Failed: Path is required and must be a string')
    expect(json.data?.path).toBe('')
  })

  it('returns Unexpected Error for a malformed JSON body', async () => {
    const res = await openFileRoute.request('/api/openFile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    })
    expect(res.status).toBe(200)
    const json = (await res.json()) as { data?: { path?: string }; error?: string }
    expect(json.error).toMatch(/^Unexpected Error:/)
    expect(json.data?.path).toBe('')
  })
})
