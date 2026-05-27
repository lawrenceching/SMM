import { describe, expect, it } from 'vitest'
import { parseFinishedFromSystemNote } from './commandExecutionLogStatus'

describe('parseFinishedFromSystemNote', () => {
  it('parses success exit', () => {
    expect(parseFinishedFromSystemNote('exit code=0 signal=null')).toEqual({
      outcome: 'success',
      exitCode: 0,
      signal: null,
    })
  })

  it('parses failure exit', () => {
    expect(parseFinishedFromSystemNote('exit code=1 signal=null')).toEqual({
      outcome: 'failure',
      exitCode: 1,
      signal: null,
    })
  })

  it('parses client abort', () => {
    expect(parseFinishedFromSystemNote('client disconnected (abort)')).toEqual({
      outcome: 'failure',
      exitCode: null,
      signal: null,
    })
  })
})
