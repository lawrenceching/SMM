import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useCommandLogQuery } from './useCommandLogQuery'
import * as commandLogApi from '@/api/commandLog'

vi.mock('@/api/commandLog', () => ({
  fetchCommandLogText: vi.fn(),
}))

const mockedFetchText = vi.mocked(commandLogApi.fetchCommandLogText)

function createWrapper(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('useCommandLogQuery', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    vi.clearAllMocks()
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
  })

  afterEach(() => {
    queryClient.clear()
  })

  it('fetches raw log text and exposes it on `data.text`', async () => {
    mockedFetchText.mockResolvedValue({
      text: '2026-06-04T22:20:46.523Z [STDOUT] hello\n',
      meta: { truncated: false, totalBytes: 36, readOffset: 0, readLimit: 36 },
    })

    const wrapper = createWrapper(queryClient)
    const { result } = renderHook(
      () => useCommandLogQuery({ executionId: 'exec-1', enabled: true, isRunning: true }),
      { wrapper },
    )

    await new Promise((r) => setTimeout(r, 50))
    expect(result.current.data?.text).toBe('2026-06-04T22:20:46.523Z [STDOUT] hello\n')
    expect(mockedFetchText).toHaveBeenCalled()
  })

  it('does not poll when isRunning is false', async () => {
    const wrapper = createWrapper(queryClient)
    renderHook(
      () => useCommandLogQuery({ executionId: 'exec-1', enabled: false, isRunning: false }),
      { wrapper },
    )
    await new Promise((r) => setTimeout(r, 10))
    expect(mockedFetchText).not.toHaveBeenCalled()
  })

  it('does not fetch when executionId is empty', async () => {
    const wrapper = createWrapper(queryClient)
    renderHook(
      () => useCommandLogQuery({ executionId: '', enabled: true, isRunning: true }),
      { wrapper },
    )
    await new Promise((r) => setTimeout(r, 10))
    expect(mockedFetchText).not.toHaveBeenCalled()
  })
})
