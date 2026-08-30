import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { searchInTvdb, toTvdbApiLanguage } from './tvdbV3'

vi.mock('@/lib/apiFetch', () => ({
  apiFetch: vi.fn(),
}))

import { apiFetch } from '@/lib/apiFetch'

const mockApiFetch = vi.mocked(apiFetch)

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('tvdbV3 Internal HTTP clients', () => {
  beforeEach(() => {
    mockApiFetch.mockReset()
  })

  afterEach(() => {
    mockApiFetch.mockReset()
  })

  it('toTvdbApiLanguage maps preferMediaLanguage to ISO 639-3', () => {
    expect(toTvdbApiLanguage('zh-CN')).toBe('zho')
    expect(toTvdbApiLanguage('en-US')).toBe('eng')
    expect(toTvdbApiLanguage('ja-JP')).toBe('jpn')
    expect(toTvdbApiLanguage('zho')).toBe('zho')
    expect(toTvdbApiLanguage(undefined)).toBeUndefined()
  })

  it('searchInTvdb maps zh-CN to zho for Core.searchInTvdb', async () => {
    mockApiFetch.mockResolvedValue(
      jsonResponse({
        data: [{ tvdb_id: '355969', name: '天使降临到了我身边！' }],
      }),
    )
    await searchInTvdb({ keyword: '天使降临到我身边', type: 'series', language: 'zh-CN' })
    expect(mockApiFetch).toHaveBeenCalledWith('/api/search-in-tvdb', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        keyword: '天使降临到我身边',
        type: 'series',
        language: 'zho',
      }),
      signal: undefined,
    })
  })

  it('searchInTvdb POSTs keyword and type', async () => {
    mockApiFetch.mockResolvedValue(
      jsonResponse({
        data: [{ tvdb_id: '421069', name: '【我推的孩子】' }],
      }),
    )
    const body = await searchInTvdb({ keyword: '我推的孩子', type: 'series', language: 'zho' })
    expect(mockApiFetch).toHaveBeenCalledWith('/api/search-in-tvdb', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keyword: '我推的孩子', type: 'series', language: 'zho' }),
      signal: undefined,
    })
    expect(body.data?.[0]?.tvdb_id).toBe('421069')
  })

  it('throws on HTTP layer failure', async () => {
    mockApiFetch.mockResolvedValue(jsonResponse({ error: 'nope' }, 500))
    await expect(searchInTvdb({ keyword: 'x', type: 'movie' })).rejects.toThrow(/HTTP Layer Error/)
  })
})
