import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import {
  useYtdlpDownloadProgressQuery,
  extractLatestProgress,
  parseYtdlpProgressLine,
} from './useYtdlpDownloadProgressQuery'
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

  it('parses percent with trailing % sign (yt-dlp _percent_json format)', () => {
    const line =
      '{"percent": "42.5%", "speed": "1234567", "eta": 42, "downloaded": 5242880, "total": 104857600, "status": "downloading"}'
    const result = parseYtdlpProgressLine(line)
    expect(result).not.toBeNull()
    expect(result?.percent).toBe(42.5)
    expect(result?.speedBps).toBe(1234567)
  })

  it('handles percent with % and padded whitespace', () => {
    const line =
      '{"percent": " 12.3%", "speed": "500000", "eta": 100, "status": "downloading"}'
    const result = parseYtdlpProgressLine(line)
    expect(result?.percent).toBe(12.3)
  })

  it('defaults speed/eta to 0 when yt-dlp reports NA (unquoted)', () => {
    const line =
      '{"percent": "NA", "speed": "NA", "eta": NA, "downloaded": 1024, "total": 572853052, "status": "downloading"}'
    const result = parseYtdlpProgressLine(line)
    expect(result).not.toBeNull()
    expect(result?.percent).toBeGreaterThan(0) // computed from downloaded/total
    expect(result?.speedBps).toBe(0)
    expect(result?.etaSeconds).toBe(0)
  })

  it('accepts quoted NA strings (new template format)', () => {
    const line =
      '{"percent": "NA", "speed": "NA", "eta": "NA", "downloaded": "1024", "total": "572853052", "status": "downloading"}'
    const result = parseYtdlpProgressLine(line)
    expect(result).not.toBeNull()
    expect(result?.percent).toBeGreaterThan(0)
    expect(result?.speedBps).toBe(0)
    expect(result?.etaSeconds).toBe(0)
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
  it('returns null for empty log text', () => {
    expect(extractLatestProgress('')).toBeNull()
  })

  it('returns null when the log has no progress JSON', () => {
    const log =
      '2026-06-04T22:20:46.523Z [STDOUT] no json here\n' +
      '2026-06-04T22:20:47.000Z [STDOUT] still no json\n'
    expect(extractLatestProgress(log)).toBeNull()
  })

  it('returns the latest progress line when found', () => {
    const log =
      '2026-06-04T22:20:46.523Z [STDOUT] {"percent":"10.0","speed":"1000","eta":90,"status":"downloading"}\n' +
      '2026-06-04T22:20:48.000Z [STDOUT] {"percent":"42.5","speed":"2000","eta":60,"status":"downloading"}\n'
    const result = extractLatestProgress(log)
    expect(result?.percent).toBe(42.5)
    expect(result?.speedBps).toBe(2000)
  })

  it('skips non-JSON lines (system / stderr)', () => {
    const log =
      '2026-06-04T22:20:46.523Z [SYSTEM] Executing command: yt-dlp ...\n' +
      '2026-06-04T22:20:48.000Z [STDERR] some warning\n' +
      '2026-06-04T22:20:50.000Z [STDOUT] {"percent":"75","speed":"500","eta":30,"status":"downloading"}\n'
    const result = extractLatestProgress(log)
    expect(result?.percent).toBe(75)
  })

  it('handles the clean (CLI-stripped) log format', () => {
    // The CLI strips ANSI escape codes at write time and prefixes each
    // line with `${ISO timestamp} [KIND] `. This test pins that contract.
    const log =
      '2026-06-04T22:20:46.523Z [STDOUT] {"percent":"88","speed":"999","eta":5,"status":"downloading"}\n'
    expect(extractLatestProgress(log)?.percent).toBe(88)
  })

  it('returns the last progress line when multiple are present', () => {
    const log =
      'irrelevant text\n' +
      '2026-06-04T22:20:46.523Z [STDOUT] {"percent":"10","speed":"100","eta":90,"status":"downloading"}\n' +
      'more text\n' +
      '2026-06-04T22:20:50.000Z [STDOUT] {"percent":"99","speed":"900","eta":1,"status":"downloading"}\n'
    expect(extractLatestProgress(log)?.percent).toBe(99)
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
    mockedFetchText.mockResolvedValue({
      text: '',
      meta: { truncated: false, totalBytes: 0, readOffset: 0, readLimit: 0 },
    })

    const wrapper = createWrapper(queryClient)
    const { result } = renderHook(
      () => useYtdlpDownloadProgressQuery({ executionId: 'exec-1', isRunning: true }),
      { wrapper },
    )

    await new Promise((r) => setTimeout(r, 50))
    expect(result.current.progress).toBeNull()
    expect(mockedFetchText).toHaveBeenCalled()
  })

  it('parses progress from raw log text', async () => {
    mockedFetchText.mockResolvedValue({
      text:
        '2026-06-04T22:20:46.523Z [STDOUT] {"percent":"55.5","speed":"1234567","eta":30,"status":"downloading"}\n',
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
    expect(mockedFetchText).not.toHaveBeenCalled()
  })
})
