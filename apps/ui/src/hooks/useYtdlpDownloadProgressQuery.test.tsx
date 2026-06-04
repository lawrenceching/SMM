import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useYtdlpDownloadProgressQuery } from './useYtdlpDownloadProgressQuery'
import * as commandLogApi from '@/api/commandLog'
import {
  extractLatestProgress,
  parseYtdlpProgressLine,
} from './useYtdlpDownloadProgressQuery'
import type { CommandLogSegment } from '@/api/commandLog'

vi.mock('@/api/commandLog', () => ({
  fetchCommandLogRaw: vi.fn(),
  fetchCommandLogSegments: vi.fn(),
}))

const mockedFetchSegments = vi.mocked(commandLogApi.fetchCommandLogSegments)

function createWrapper(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('parseYtdlpProgressLine', () => {
  it('parses a downloading line with valid numbers', () => {
    const line =
      '{"percent": "42.3", "speed": "1234567", "eta": 42, "downloaded": 5242880, "total": 104857600, "status": "downloading"}'
    const result = parseYtdlpProgressLine(line)
    expect(result).not.toBeNull()
    expect(result?.percent).toBe(42.3)
    expect(result?.speedBps).toBe(1234567)
    expect(result?.etaSeconds).toBe(42)
    expect(result?.downloadedBytes).toBe(5242880)
    expect(result?.totalBytes).toBe(104857600)
    expect(result?.status).toBe('downloading')
  })

  it('parses a finished line', () => {
    const line =
      '{"percent": "100", "speed": "NA", "eta": 0, "downloaded": 5242880, "total": 5242880, "status": "finished"}'
    const result = parseYtdlpProgressLine(line)
    expect(result?.status).toBe('finished')
  })

  it('replaces unquoted NA with null and parses', () => {
    const line =
      '{"percent": "NA", "speed": "NA", "eta": NA, "downloaded": 1024, "total": 572853052, "status": "downloading"}'
    const result = parseYtdlpProgressLine(line)
    expect(result).not.toBeNull()
    expect(result?.percent).toBeGreaterThan(0) // computed from downloaded/total
    expect(result?.etaSeconds).toBeNull()
  })

  it('returns null for non-progress JSON (missing status)', () => {
    expect(parseYtdlpProgressLine('{"foo": "bar"}')).toBeNull()
  })

  it('returns null for invalid JSON', () => {
    expect(parseYtdlpProgressLine('not json at all')).toBeNull()
  })

  it('returns null for status that is not downloading/finished', () => {
    expect(parseYtdlpProgressLine('{"status": "unknown"}')).toBeNull()
  })
})

describe('extractLatestProgress', () => {
  it('returns null for empty segments', () => {
    expect(extractLatestProgress([])).toBeNull()
  })

  it('returns null when no segment has progress JSON', () => {
    const segs: CommandLogSegment[] = [
      { kind: 'stdout', ts: 't1', body: 'no json here\nstill no json' },
      { kind: 'stderr', ts: 't2', body: 'whatever' },
    ]
    expect(extractLatestProgress(segs)).toBeNull()
  })

  it('returns the latest progress from the latest stdout segment', () => {
    const segs: CommandLogSegment[] = [
      { kind: 'stdout', ts: 't1', body: '{"percent": "10.0", "speed": "1000", "eta": 90, "status": "downloading"}' },
      { kind: 'stdout', ts: 't2', body: '{"percent": "42.5", "speed": "2000", "eta": 60, "status": "downloading"}' },
    ]
    const result = extractLatestProgress(segs)
    expect(result?.percent).toBe(42.5)
    expect(result?.speedBps).toBe(2000)
  })

  it('skips non-stdout segments', () => {
    const segs: CommandLogSegment[] = [
      { kind: 'stdout', ts: 't1', body: '{"percent": "10", "speed": "100", "eta": 90, "status": "downloading"}' },
      { kind: 'system', ts: 't2', body: 'something' },
      { kind: 'stderr', ts: 't3', body: 'err' },
      { kind: 'stdout', ts: 't4', body: '{"percent": "75", "speed": "500", "eta": 30, "status": "downloading"}' },
    ]
    const result = extractLatestProgress(segs)
    expect(result?.percent).toBe(75)
  })

  it('strips ANSI escape codes before parsing', () => {
    const segs: CommandLogSegment[] = [
      {
        kind: 'stdout',
        ts: 't1',
        body: '\x1b[2J\x1b[H{"percent": "88", "speed": "999", "eta": 5, "status": "downloading"}\x1b[K',
      },
    ]
    const result = extractLatestProgress(segs)
    expect(result?.percent).toBe(88)
  })

  it('handles multi-line segment bodies (latest line wins)', () => {
    const segs: CommandLogSegment[] = [
      {
        kind: 'stdout',
        ts: 't1',
        body: [
          'irrelevant text',
          '{"percent": "10", "speed": "100", "eta": 90, "status": "downloading"}',
          'more text',
          '{"percent": "99", "speed": "900", "eta": 1, "status": "downloading"}',
        ].join('\n'),
      },
    ]
    const result = extractLatestProgress(segs)
    expect(result?.percent).toBe(99)
  })
})

describe('useYtdlpDownloadProgressQuery', () => {
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

  it('returns null progress when log is empty', async () => {
    mockedFetchSegments.mockResolvedValue({
      body: { totalBytes: 0, truncated: false, offset: 0, limit: 0, segments: [] },
      meta: { truncated: false, totalBytes: 0, readOffset: 0, readLimit: 0 },
    })

    const wrapper = createWrapper(queryClient)
    const { result } = renderHook(
      () => useYtdlpDownloadProgressQuery({ executionId: 'exec-1', isRunning: true }),
      { wrapper },
    )

    await new Promise((r) => setTimeout(r, 50))
    expect(result.current.progress).toBeNull()
    expect(mockedFetchSegments).toHaveBeenCalled()
  })

  it('parses progress from segments', async () => {
    mockedFetchSegments.mockResolvedValue({
      body: {
        totalBytes: 100,
        truncated: false,
        offset: 0,
        limit: 100,
        segments: [
          {
            kind: 'stdout',
            ts: 't1',
            body: '{"percent": "55.5", "speed": "1234567", "eta": 30, "status": "downloading"}',
          },
        ],
      },
      meta: { truncated: false, totalBytes: 100, readOffset: 0, readLimit: 100 },
    })

    const wrapper = createWrapper(queryClient)
    const { result } = renderHook(
      () => useYtdlpDownloadProgressQuery({ executionId: 'exec-1', isRunning: true }),
      { wrapper },
    )

    await new Promise((r) => setTimeout(r, 50))
    expect(result.current.progress).not.toBeNull()
    expect(result.current.progress?.percent).toBe(55.5)
    expect(result.current.progress?.speedBps).toBe(1234567)
    expect(result.current.progress?.etaSeconds).toBe(30)
  })

  it('does not poll when isRunning is false', async () => {
    const wrapper = createWrapper(queryClient)
    renderHook(
      () => useYtdlpDownloadProgressQuery({ executionId: 'exec-1', isRunning: false }),
      { wrapper },
    )
    await new Promise((r) => setTimeout(r, 10))
    expect(mockedFetchSegments).not.toHaveBeenCalled()
  })
})
