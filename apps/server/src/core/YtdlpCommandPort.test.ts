import { describe, expect, it } from 'vitest'
import { parseYtdlpProgressLine } from '@smm/core'
import { ytdlpProgressDataToStdoutLine } from './YtdlpCommandPort'

describe('ytdlpProgressDataToStdoutLine', () => {
  it('round-trips through Core parseYtdlpProgressLine', () => {
    const line = ytdlpProgressDataToStdoutLine({
      percent: 42.5,
      speed: 1_024_000,
      eta: 33,
      downloaded: 42,
      total: 100,
      status: 'downloading',
    })
    const parsed = parseYtdlpProgressLine(line)
    expect(parsed).toEqual({
      percent: 42.5,
      speed: 1_024_000,
      eta: 33,
      downloaded: 42,
      total: 100,
      status: 'downloading',
    })
  })

  it('supports finished status with null eta', () => {
    const line = ytdlpProgressDataToStdoutLine({
      percent: 100,
      speed: 0,
      eta: null,
      downloaded: 100,
      total: 100,
      status: 'finished',
    })
    expect(parseYtdlpProgressLine(line)?.status).toBe('finished')
    expect(parseYtdlpProgressLine(line)?.percent).toBe(100)
  })
})
