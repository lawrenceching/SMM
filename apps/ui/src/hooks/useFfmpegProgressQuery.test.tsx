import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import {
  useFfmpegProgressQuery,
  extractLatestFfmpegProgress,
  parseFfmpegProgressLine,
  parseHmsTime,
  stripLogLinePrefix,
} from './useFfmpegProgressQuery'
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

describe('parseHmsTime', () => {
  it('parses HH:MM:SS.xx', () => {
    expect(parseHmsTime('00:02:59.71')).toBeCloseTo(179.71, 5)
    expect(parseHmsTime('00:00:02.50')).toBeCloseTo(2.5, 5)
    expect(parseHmsTime('01:00:00')).toBe(3600)
    expect(parseHmsTime('00:00:00.5')).toBe(0.5)
    expect(parseHmsTime('00:00:00')).toBe(0)
  })

  it('accepts whitespace around the value', () => {
    expect(parseHmsTime('  00:00:01.00  ')).toBe(1)
  })

  it('returns null on malformed input', () => {
    expect(parseHmsTime('not a time')).toBeNull()
    expect(parseHmsTime('1:2:3')).toBeNull()
    expect(parseHmsTime('00:00')).toBeNull()
    expect(parseHmsTime('')).toBeNull()
  })
})

describe('stripLogLinePrefix', () => {
  it('strips the CLI log prefix', () => {
    expect(
      stripLogLinePrefix('2026-06-09T17:19:22.593Z [STDERR] frame=  77 fps=0.0'),
    ).toBe('frame=  77 fps=0.0')
  })

  it('strips STDOUT and SYSTEM prefixes too', () => {
    expect(stripLogLinePrefix('2026-06-09T17:19:22.000Z [STDOUT] hello')).toBe('hello')
    expect(stripLogLinePrefix('2026-06-09T17:19:22.000Z [SYSTEM] hi')).toBe('hi')
  })

  it('returns the line unchanged when no prefix is present', () => {
    expect(stripLogLinePrefix('frame= 77 fps=0.0')).toBe('frame= 77 fps=0.0')
  })
})

describe('parseFfmpegProgressLine', () => {
  it('parses a standard progress line with both time= and speed=', () => {
    const line =
      '2026-06-09T17:19:22.593Z [STDERR] frame=   77 fps=0.0 q=31.9 size=       0KiB time=00:00:02.50 bitrate=   0.1kbits/s speed=4.77x elapsed=0:00:00.52'
    const result = parseFfmpegProgressLine(line)
    expect(result).not.toBeNull()
    expect(result?.currentSeconds).toBeCloseTo(2.5, 5)
    expect(result?.speedMultiplier).toBe(4.77)
  })

  it('parses a final progress line at the end of an encode', () => {
    const line =
      'frame= 5390 fps=253 q=39.7 Lsize=    4998KiB time=00:02:59.60 bitrate= 227.9kbits/s speed=8.41x elapsed=0:00:21.34'
    const result = parseFfmpegProgressLine(line)
    expect(result?.currentSeconds).toBeCloseTo(179.6, 5)
    expect(result?.speedMultiplier).toBe(8.41)
  })

  it('handles speed with no decimal (e.g. 8x)', () => {
    const line = 'time=00:00:10.00 speed=8x'
    expect(parseFfmpegProgressLine(line)?.speedMultiplier).toBe(8)
  })

  it('handles extra whitespace around speed', () => {
    const line = 'time=00:00:10.00 bitrate=0kbits/s speed=  7.28x'
    expect(parseFfmpegProgressLine(line)?.speedMultiplier).toBe(7.28)
  })

  it('returns null speed when speed= is absent', () => {
    const line = 'frame=   77 fps=0.0 time=00:00:02.50 bitrate=0.1kbits/s'
    expect(parseFfmpegProgressLine(line)?.speedMultiplier).toBeNull()
  })

  it('returns null for non-progress lines', () => {
    expect(parseFfmpegProgressLine('Duration: 00:02:59.71, start: 0.000000')).toBeNull()
    expect(parseFfmpegProgressLine('Stream #0:0 -> #0:0 (av1 -> hevc)')).toBeNull()
    expect(parseFfmpegProgressLine('frame= 1 fps=0 q=-1.0 size=N/A')).toBeNull() // no time=
  })

  it('returns null for a progress line with malformed time=', () => {
    const line = 'time=NaN speed=1x'
    expect(parseFfmpegProgressLine(line)).toBeNull()
  })
})

describe('extractLatestFfmpegProgress', () => {
  it('returns null for empty input', () => {
    expect(extractLatestFfmpegProgress('')).toBeNull()
  })

  it('returns null when no Duration line is present', () => {
    const log =
      '2026-06-09T17:19:22.000Z [STDERR] Stream #0:0 -> #0:0\n' +
      '2026-06-09T17:19:22.100Z [STDERR] frame=  10 fps=100 q=31 time=00:00:01.00 speed=4x'
    expect(extractLatestFfmpegProgress(log)).toBeNull()
  })

  it('returns percent null when Duration is present but no progress line yet', () => {
    const log =
      '2026-06-09T17:19:22.058Z [STDERR]   Duration: 00:02:59.71, start: 0.000000, bitrate: 793 kb/s\n' +
      '2026-06-09T17:19:22.101Z [STDERR] x265 [info]: HEVC encoder version 4.1\n'
    const result = extractLatestFfmpegProgress(log)
    expect(result).not.toBeNull()
    expect(result?.totalSeconds).toBeCloseTo(179.71, 5)
    expect(result?.percent).toBeNull()
    expect(result?.currentSeconds).toBe(0)
    expect(result?.etaSeconds).toBeNull()
  })

  it('computes percent and ETA from a typical ffmpeg log', () => {
    const log =
      '2026-06-09T17:19:22.058Z [STDERR]   Duration: 00:02:59.71, start: 0.000000, bitrate: 793 kb/s\n' +
      '2026-06-09T17:19:22.101Z [STDERR] Stream mapping:\n' +
      '2026-06-09T17:19:23.103Z [STDERR] frame=  228 fps=220 q=39.7 size=     256KiB time=00:00:07.53 bitrate= 278.4kbits/s speed=7.28x elapsed=0:00:01.03\n' +
      '2026-06-09T17:19:25.676Z [STDERR] frame=  931 fps=258 q=39.6 size=     768KiB time=00:00:30.96 bitrate= 203.2kbits/s speed=8.58x elapsed=0:00:03.60\n' +
      '2026-06-09T17:19:37.542Z [STDERR] frame= 3921 fps=253 q=39.7 size=    3328KiB time=00:02:10.63 bitrate= 208.7kbits/s speed=8.44x elapsed=0:00:15.47\n'
    const result = extractLatestFfmpegProgress(log)
    expect(result).not.toBeNull()
    expect(result?.totalSeconds).toBeCloseTo(179.71, 5)
    expect(result?.currentSeconds).toBeCloseTo(130.63, 5)
    // percent: 130.63 / 179.71 * 100 ≈ 72.69
    expect(result?.percent).toBeCloseTo(72.69, 1)
    // eta: (179.71 - 130.63) / 8.44 ≈ 5.81
    expect(result?.etaSeconds).toBeCloseTo(5.81, 1)
    expect(result?.speedMultiplier).toBe(8.44)
  })

  it('returns percent 100 and eta 0 when current time equals total duration', () => {
    const log =
      'Duration: 00:01:00.00, start: 0.000000\n' +
      'frame= 1500 fps=250 time=00:01:00.00 speed=8x\n'
    const result = extractLatestFfmpegProgress(log)
    expect(result?.percent).toBe(100)
    expect(result?.etaSeconds).toBe(0)
  })

  it('returns null eta when speed is absent', () => {
    const log =
      'Duration: 00:01:00.00, start: 0.000000\n' +
      'frame= 100 fps=100 time=00:00:30.00\n'
    const result = extractLatestFfmpegProgress(log)
    expect(result?.percent).toBe(50)
    expect(result?.etaSeconds).toBeNull()
  })

  it('picks the latest progress line (most recent time=) when many are present', () => {
    const log =
      'Duration: 00:01:00.00\n' +
      'frame= 100 fps=100 time=00:00:10.00 speed=4x\n' +
      'frame= 500 fps=120 time=00:00:50.00 speed=5x\n' +
      'frame= 200 fps=110 time=00:00:20.00 speed=4x\n'
    const result = extractLatestFfmpegProgress(log)
    // The latest line wins — its time=00:00:20.00 (NOT 00:00:50.00).
    expect(result?.currentSeconds).toBe(20)
    expect(result?.speedMultiplier).toBe(4)
  })

  it('handles the CLI prefixed log format', () => {
    const log =
      '2026-06-09T17:19:22.058Z [STDERR]   Duration: 00:01:00.00, start: 0.000000\n' +
      '2026-06-09T17:19:25.000Z [STDERR] frame= 1500 fps=250 time=00:00:30.00 speed=8x'
    const result = extractLatestFfmpegProgress(log)
    expect(result?.totalSeconds).toBe(60)
    expect(result?.currentSeconds).toBe(30)
    expect(result?.percent).toBe(50)
  })

  it('clamps percent to [0, 100]', () => {
    // Edge: totalSeconds slightly under currentSeconds (rounding at the end of an encode)
    const log =
      'Duration: 00:01:00.00\n' +
      'frame= 1 fps=0 time=00:01:00.05 speed=10x\n'
    const result = extractLatestFfmpegProgress(log)
    expect(result?.percent).toBe(100)
  })

  it('ignores Duration lines with 0 seconds', () => {
    // ffmpeg may emit "Duration: N/A" early — handled by parseHmsTime returning null
    const log =
      'Duration: N/A, bitrate: N/A\n' +
      'Duration: 00:01:00.00\n' +
      'time=00:00:30.00 speed=4x\n'
    const result = extractLatestFfmpegProgress(log)
    expect(result?.totalSeconds).toBe(60)
  })
})

describe('useFfmpegProgressQuery', () => {
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
      () => useFfmpegProgressQuery({ executionId: 'exec-1', isRunning: true }),
      { wrapper },
    )

    await new Promise((r) => setTimeout(r, 50))
    expect(result.current.progress).toBeNull()
    expect(mockedFetchText).toHaveBeenCalled()
  })

  it('parses progress from raw log text', async () => {
    mockedFetchText.mockResolvedValue({
      text:
        '2026-06-09T17:19:22.058Z [STDERR]   Duration: 00:01:00.00, start: 0.000000\n' +
        '2026-06-09T17:19:25.000Z [STDERR] frame= 1500 fps=250 time=00:00:30.00 speed=8x\n',
      meta: { truncated: false, totalBytes: 100, readOffset: 0, readLimit: 100 },
    })

    const wrapper = createWrapper(queryClient)
    const { result } = renderHook(
      () => useFfmpegProgressQuery({ executionId: 'exec-1', isRunning: true }),
      { wrapper },
    )

    await new Promise((r) => setTimeout(r, 50))
    expect(result.current.progress).not.toBeNull()
    expect(result.current.progress?.totalSeconds).toBe(60)
    expect(result.current.progress?.currentSeconds).toBe(30)
    expect(result.current.progress?.percent).toBe(50)
    // eta: (60 - 30) / 8 = 3.75
    expect(result.current.progress?.etaSeconds).toBeCloseTo(3.75, 2)
  })

  it('does not poll when isRunning is false', async () => {
    const wrapper = createWrapper(queryClient)
    renderHook(
      () => useFfmpegProgressQuery({ executionId: 'exec-1', isRunning: false }),
      { wrapper },
    )
    await new Promise((r) => setTimeout(r, 10))
    expect(mockedFetchText).not.toHaveBeenCalled()
  })
})