import { describe, expect, it } from 'vitest'
import { moveFileToTrashRoute } from './MoveFileToTrash'

describe('POST /api/moveFileToTrash', () => {
  async function post(body: unknown) {
    return moveFileToTrashRoute.request('/api/moveFileToTrash', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  it('returns in-band validation error when path is empty', async () => {
    const res = await post({ path: '' })
    expect(res.status).toBe(200)
    const json = (await res.json()) as { data?: { path?: string }; error?: string }
    expect(json.error).toBe('Validation Failed: Path is required')
    expect(json.data?.path).toBe('')
  })

  it('returns catch-all error shape when the file is not found', async () => {
    const res = await post({ path: 'Z:/__smm_missing__/no-such-file.txt' })
    expect(res.status).toBe(200)
    const json = (await res.json()) as { data?: { path?: string }; error?: string }
    expect(json.error).toMatch(/^File Not Found: .+ was not found$/)
    expect(json.data?.path).toContain('no-such-file.txt')
  })
})
