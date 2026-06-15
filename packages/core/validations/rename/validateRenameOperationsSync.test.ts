import { describe, it, expect } from 'vitest'
import { validateRenameOperationsSync } from './validateRenameOperationsSync'

describe('validateRenameOperationsSync', () => {
  const mediaFolder = '/home/user/media/show'

  it('returns valid for empty input', () => {
    const result = validateRenameOperationsSync([], mediaFolder)
    expect(result.isValid).toBe(true)
    expect(result.errors).toEqual([])
    expect(result.validatedRenames).toEqual([])
  })

  it('rejects duplicate source paths', () => {
    const result = validateRenameOperationsSync(
      [
        { from: `${mediaFolder}/a.mp4`, to: `${mediaFolder}/b.mp4` },
        { from: `${mediaFolder}/a.mp4`, to: `${mediaFolder}/c.mp4` },
      ],
      mediaFolder,
    )
    expect(result.isValid).toBe(false)
    expect(result.errors.some((e) => e.includes('appears multiple times'))).toBe(true)
  })

  it('rejects paths outside media folder', () => {
    const result = validateRenameOperationsSync(
      [{ from: '/other/a.mp4', to: `${mediaFolder}/b.mp4` }],
      mediaFolder,
    )
    expect(result.isValid).toBe(false)
    expect(result.errors.some((e) => e.includes('outside the media folder'))).toBe(true)
  })

  it('accepts a valid single rename', () => {
    const result = validateRenameOperationsSync(
      [{ from: `${mediaFolder}/a.mp4`, to: `${mediaFolder}/b.mp4` }],
      mediaFolder,
    )
    expect(result.isValid).toBe(true)
    expect(result.validatedRenames).toHaveLength(1)
  })
})
