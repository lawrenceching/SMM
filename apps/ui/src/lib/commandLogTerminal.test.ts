import { describe, expect, it } from 'vitest'
import { isTerminalCommandLogText } from './commandLogTerminal'

describe('isTerminalCommandLogText', () => {
  it('detects client disconnect note', () => {
    expect(
      isTerminalCommandLogText('--- system ts=2026-01-01T00:00:00.000Z ---\nclient disconnected (abort)\n'),
    ).toBe(true)
  })

  it('detects exit code note', () => {
    expect(isTerminalCommandLogText('--- system ts=2026-01-01T00:00:00.000Z ---\nexit code=1 signal=null\n')).toBe(
      true,
    )
  })

  it('returns false for in-progress spawn only', () => {
    expect(isTerminalCommandLogText('--- system ts=2026-01-01T00:00:00.000Z ---\nspawn command=yt-dlp\n')).toBe(
      false,
    )
  })
})
