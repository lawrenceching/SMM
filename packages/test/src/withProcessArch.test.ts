import { describe, expect, it } from 'vitest'
import { withProcessArch } from './withProcessArch'

describe('withProcessArch', () => {
  it('pins process.arch for the callback and restores it afterwards', async () => {
    const original = process.arch
    const seen = await withProcessArch('arm64', () => process.arch)
    expect(seen).toBe('arm64')
    expect(process.arch).toBe(original)
  })
})
