import { describe, it, expect } from 'vitest'
import { isJobRemovable } from './backgroundJobLifecycle'

describe('isJobRemovable', () => {
  it('returns true for non-running statuses', () => {
    expect(isJobRemovable('pending')).toBe(true)
    expect(isJobRemovable('succeeded')).toBe(true)
    expect(isJobRemovable('failed')).toBe(true)
    expect(isJobRemovable('aborted')).toBe(true)
  })

  it('returns false only for running', () => {
    expect(isJobRemovable('running')).toBe(false)
  })
})
