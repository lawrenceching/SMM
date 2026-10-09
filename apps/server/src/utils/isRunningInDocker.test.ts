import { afterEach, describe, expect, it, vi } from 'vitest'

const existsSync = vi.hoisted(() => vi.fn())

vi.mock('node:fs', () => ({
  existsSync,
}))

import { isRunningInDocker } from './isRunningInDocker'

describe('isRunningInDocker', () => {
  afterEach(() => {
    existsSync.mockReset()
  })

  it('returns true when /.dockerenv exists', () => {
    existsSync.mockReturnValue(true)
    expect(isRunningInDocker()).toBe(true)
    expect(existsSync).toHaveBeenCalledWith('/.dockerenv')
  })

  it('returns false when /.dockerenv is absent', () => {
    existsSync.mockReturnValue(false)
    expect(isRunningInDocker()).toBe(false)
  })

  it('returns false when existsSync throws', () => {
    existsSync.mockImplementation(() => {
      throw new Error('EACCES')
    })
    expect(isRunningInDocker()).toBe(false)
  })
})
