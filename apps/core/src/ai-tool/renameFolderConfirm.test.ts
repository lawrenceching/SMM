import { describe, it, expect } from 'vitest'
import {
  buildRenameFolderConfirmationMessage,
  getFolderBasename,
} from './renameFolderConfirm'

describe('renameFolderConfirm', () => {
  it('getFolderBasename returns last path segment', () => {
    expect(getFolderBasename('/media/shows/My Show')).toBe('My Show')
  })

  it('buildRenameFolderConfirmationMessage includes folder names', () => {
    const msg = buildRenameFolderConfirmationMessage(
      '/media/old',
      '/media/new',
    )
    expect(msg).toContain('"old"')
    expect(msg).toContain('"new"')
    expect(msg).toContain('Rename the folder on disk')
  })
})
