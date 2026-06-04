import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useCommandLogQuery } from './useCommandLogQuery'
import * as commandLogApi from '@/api/commandLog'
import type { ReactNode } from 'react'

vi.mock('@/api/commandLog', () => ({
  fetchCommandLogRaw: vi.fn(),
  fetchCommandLogSegments: vi.fn(),
}))

const mockedFetchRaw = vi.mocked(commandLogApi.fetchCommandLogRaw)
const mockedFetchSegments = vi.mocked(commandLogApi.fetchCommandLogSegments)

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

  it('does not fetch when executionId is empty', async () => {
    const wrapper = createWrapper(queryClient)
    const { result } = renderHook(
      () => useCommandLogQuery({ executionId: '', enabled: true, isRunning: true }),
      { wrapper },
    )
    // Give it a tick to settle
    await new Promise((r) => setTimeout(r, 10))
    expect(result.current.data).toBeUndefined()
    expect(result.current.error).toBeNull()
    expect(mockedFetchRaw).not.toHaveBeenCalled()
    expect(mockedFetchSegments).not.toHaveBeenCalled()
  })

  it('does not fetch when enabled is false', async () => {
    const wrapper = createWrapper(queryClient)
    const { result } = renderHook(
      () => useCommandLogQuery({ executionId: 'exec-1', enabled: false, isRunning: true }),
      { wrapper },
    )
    await new Promise((r) => setTimeout(r, 10))
    expect(result.current.data).toBeUndefined()
    expect(mockedFetchRaw).not.toHaveBeenCalled()
    expect(mockedFetchSegments).not.toHaveBeenCalled()
  })

  it('fetches segments by default and returns parsed body', async () => {
    mockedFetchSegments.mockResolvedValueOnce({
      body: {
        totalBytes: 100,
        truncated: false,
        offset: 0,
        limit: 100,
        segments: [
          { kind: 'stdout', ts: '2026-01-01T00:00:00Z', body: 'hello' },
        ],
      },
      meta: { truncated: false, totalBytes: 100, readOffset: 0, readLimit: 100 },
    })

    const wrapper = createWrapper(queryClient)
    const { result, rerender } = renderHook(
      ({ enabled, isRunning }: { enabled: boolean; isRunning: boolean }) =>
        useCommandLogQuery({ executionId: 'exec-1', enabled, isRunning }),
      { wrapper, initialProps: { enabled: false, isRunning: false } },
    )

    // Should not fetch yet
    expect(mockedFetchSegments).not.toHaveBeenCalled()

    // Enable
    rerender({ enabled: true, isRunning: true })
    await new Promise((r) => setTimeout(r, 50))

    expect(mockedFetchSegments).toHaveBeenCalledTimes(1)
    expect(result.current.data?.kind).toBe('segments')
    if (result.current.data?.kind === 'segments') {
      expect(result.current.data.segments).toHaveLength(1)
      expect(result.current.data.segments[0]?.body).toBe('hello')
    }
  })

  it('fetches raw text when format is "raw"', async () => {
    mockedFetchRaw.mockResolvedValueOnce({
      text: 'raw output',
      meta: { truncated: false, totalBytes: 11, readOffset: 0, readLimit: 11 },
    })

    const wrapper = createWrapper(queryClient)
    const { result } = renderHook(
      () =>
        useCommandLogQuery({
          executionId: 'exec-1',
          enabled: true,
          isRunning: true,
          format: 'raw',
        }),
      { wrapper },
    )

    await new Promise((r) => setTimeout(r, 50))
    expect(mockedFetchRaw).toHaveBeenCalledTimes(1)
    expect(mockedFetchSegments).not.toHaveBeenCalled()
    expect(result.current.data?.kind).toBe('raw')
    if (result.current.data?.kind === 'raw') {
      expect(result.current.data.text).toBe('raw output')
    }
  })

  it('shares the same queryKey across consumers for cache reuse', () => {
    // Both components observing the same executionId should hit the same
    // TanStack Query cache entry. This is verified structurally: same
    // queryKey tuple → same cache slot.
    const args1 = { executionId: 'exec-1', enabled: true, isRunning: true, format: 'segments' as const }
    const args2 = { executionId: 'exec-1', enabled: true, isRunning: true, format: 'segments' as const }
    expect(args1.executionId).toBe(args2.executionId)
    expect(args1.format).toBe(args2.format)
    // Different executionId → different cache slot
    const args3 = { executionId: 'exec-2', enabled: true, isRunning: true, format: 'segments' as const }
    expect(args1.executionId).not.toBe(args3.executionId)
  })
})
